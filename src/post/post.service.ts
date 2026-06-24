import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import type { PostDetailDto, PostImageDto, SnapDetailDto, ArticleDetailDto } from './dto/post-response.dto';
import { Prisma } from '@prisma/client';

const TENANT_ID = 'pono';

// TipTap JSON에서 첫 번째 이미지 URL 추출
function extractFirstImageUrl(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const node = body as Record<string, unknown>;

  if (node['type'] === 'image') {
    const attrs = node['attrs'] as Record<string, unknown> | undefined;
    if (attrs && typeof attrs['src'] === 'string') {
      return attrs['src'];
    }
  }

  if (Array.isArray(node['content'])) {
    for (const child of node['content'] as unknown[]) {
      const found = extractFirstImageUrl(child);
      if (found) return found;
    }
  }

  return null;
}

// 텍스트 글자수 추출 (readingTime 계산용)
function extractTextLength(body: unknown): number {
  if (!body || typeof body !== 'object') return 0;
  const parts: string[] = [];

  function collect(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n['type'] === 'text' && typeof n['text'] === 'string') {
      parts.push(n['text']);
    }
    if (Array.isArray(n['content'])) {
      for (const child of n['content']) collect(child);
    }
  }

  collect(body);
  return parts.join('').length;
}

type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    author: true;
    _count: { select: { likes: true; comments: true } };
    likes: true;
  };
}>;

function mapToPostDetail(
  post: PostWithRelations,
  userId: string | null,
  isOwnedByMe: boolean,
): PostDetailDto {
  const author = {
    id: post.author.id,
    username: post.author.username,
    avatar: post.author.avatar,
  };

  const likeCount = post._count.likes;
  const commentCount = post._count.comments;
  const likedByMe = userId
    ? post.likes.some((l) => l.userId === userId)
    : false;

  if (post.type === 'snap') {
    const snap: SnapDetailDto = {
      id: post.id,
      type: 'snap',
      author,
      images: (post.images as PostImageDto[] | null) ?? [],
      caption: post.caption,
      likeCount,
      likedByMe,
      isOwnedByMe,
      commentCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
    return snap;
  }

  const article: ArticleDetailDto = {
    id: post.id,
    type: 'article',
    author,
    title: post.title ?? '',
    body: (post.body as object) ?? {},
    coverImage: post.coverImage,
    readingTime: post.readingTime ?? 1,
    isDraft: post.isDraft,
    likeCount,
    likedByMe,
    isOwnedByMe,
    commentCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
  return article;
}

@Injectable()
export class PostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async createPresignedUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; fileUrl: string }> {
    return this.s3.createPresignedUrl(filename, contentType);
  }

  async createPost(
    dto: CreatePostDto,
    userId: string,
  ): Promise<PostDetailDto> {
    if (dto.type === 'snap') {
      return this.createSnap(dto, userId);
    }
    return this.createArticle(dto, userId);
  }

  private async createSnap(
    dto: CreatePostDto,
    userId: string,
  ): Promise<PostDetailDto> {
    if (!dto.images || dto.images.length === 0) {
      throw new BadRequestException('스냅은 이미지가 최소 1장 필요합니다.');
    }

    const post = await this.prisma.post.create({
      data: {
        type: 'snap',
        images: dto.images as unknown as Prisma.InputJsonValue,
        caption: dto.caption ?? null,
        authorId: userId,
        tenantId: TENANT_ID,
      },
      include: {
        author: true,
        _count: { select: { likes: true, comments: true } },
        likes: false,
      },
    });

    return mapToPostDetail({ ...post, likes: [] }, userId, true);
  }

  private async createArticle(
    dto: CreatePostDto,
    userId: string,
  ): Promise<PostDetailDto> {
    if (!dto.title) {
      throw new BadRequestException('아티클은 제목이 필요합니다.');
    }

    const isDraft = dto.isDraft ?? false;
    const body = dto.body ?? null;

    // coverImage 자동 추출
    let coverImage: string | null = dto.coverImage ?? null;
    if (!coverImage && body) {
      coverImage = extractFirstImageUrl(body);
    }

    // readingTime 자동 계산
    const charCount = body ? extractTextLength(body) : 0;
    const readingTime = Math.max(1, Math.ceil(charCount / 500));

    const post = await this.prisma.post.create({
      data: {
        type: 'article',
        title: dto.title,
        body: body ? (body as Prisma.InputJsonValue) : Prisma.JsonNull,
        coverImage,
        readingTime,
        isDraft,
        authorId: userId,
        tenantId: TENANT_ID,
      },
      include: {
        author: true,
        _count: { select: { likes: true, comments: true } },
        likes: false,
      },
    });

    return mapToPostDetail({ ...post, likes: [] }, userId, true);
  }

  // ── 공통 포스트 조회 헬퍼 ────────────────────────────────────────
  private async findPostWithRelations(postId: string) {
    return this.prisma.post.findFirst({
      where: { id: postId, tenantId: TENANT_ID },
      include: {
        author: true,
        _count: { select: { likes: true, comments: true } },
        likes: true,
      },
    });
  }

  // ── GET /posts/:id ───────────────────────────────────────────────
  async getPostDetail(
    postId: string,
    requestUser: { id: string; clerkId: string } | null,
  ): Promise<PostDetailDto> {
    const post = await this.findPostWithRelations(postId);

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    const isOwner = requestUser
      ? post.author.clerkId === requestUser.clerkId
      : false;

    // isDraft 포스트는 작성자 본인만 조회 가능
    if (post.isDraft && !isOwner) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    return mapToPostDetail(post, requestUser?.id ?? null, isOwner);
  }

  // ── PATCH /posts/:id ─────────────────────────────────────────────
  async updatePost(
    postId: string,
    dto: UpdatePostDto,
    requestUser: { id: string; clerkId: string },
  ): Promise<PostDetailDto> {
    const post = await this.findPostWithRelations(postId);

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    if (post.author.clerkId !== requestUser.clerkId) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    if (post.type === 'snap') {
      const updated = await this.prisma.post.update({
        where: { id: postId },
        data: { caption: dto.caption ?? post.caption },
        include: {
          author: true,
          _count: { select: { likes: true, comments: true } },
          likes: true,
        },
      });
      return mapToPostDetail(updated, requestUser.id, true);
    }

    // article
    const newBody = dto.body !== undefined ? dto.body : (post.body as object | null);
    const wasPublishing = dto.isDraft === false && post.isDraft === true;

    // coverImage 처리: 명시적 null이면 null, 전달 안 하면 기존 값 유지, 발행 시 자동 추출
    let newCoverImage: string | null;
    if ('coverImage' in dto) {
      newCoverImage = dto.coverImage ?? null;
    } else if (wasPublishing && !post.coverImage && newBody) {
      newCoverImage = extractFirstImageUrl(newBody) ?? null;
    } else {
      newCoverImage = post.coverImage;
    }

    // 발행 시 커버이미지 자동 추출 (coverImage 미전달 + 기존 값 없음)
    if (wasPublishing && !newCoverImage && newBody) {
      newCoverImage = extractFirstImageUrl(newBody) ?? null;
    }

    // readingTime 재계산: isDraft false로 변경 시
    let newReadingTime = post.readingTime ?? 1;
    if (wasPublishing && newBody) {
      const charCount = extractTextLength(newBody);
      newReadingTime = Math.max(1, Math.ceil(charCount / 500));
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        title: dto.title !== undefined ? dto.title : post.title,
        body: newBody ? (newBody as Prisma.InputJsonValue) : Prisma.JsonNull,
        coverImage: newCoverImage,
        isDraft: dto.isDraft !== undefined ? dto.isDraft : post.isDraft,
        readingTime: newReadingTime,
      },
      include: {
        author: true,
        _count: { select: { likes: true, comments: true } },
        likes: true,
      },
    });
    return mapToPostDetail(updated, requestUser.id, true);
  }

  // ── DELETE /posts/:id ────────────────────────────────────────────
  async deletePost(
    postId: string,
    requestUser: { id: string; clerkId: string },
  ): Promise<{ id: string }> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, tenantId: TENANT_ID },
      include: { author: true },
    });

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    if (post.author.clerkId !== requestUser.clerkId) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }

    await this.prisma.post.delete({ where: { id: postId } });

    // 스냅 이미지 S3 비동기 삭제 (fire-and-forget)
    if (post.type === 'snap' && Array.isArray(post.images)) {
      const images = post.images as unknown as PostImageDto[];
      void Promise.all(
        images.map((img) => this.s3.deleteObject(img.url).catch(() => null)),
      );
    }

    return { id: postId };
  }
}
