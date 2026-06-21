import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { CreatePostDto } from './dto/create-post.dto';
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

    return mapToPostDetail({ ...post, likes: [] }, userId);
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

    return mapToPostDetail({ ...post, likes: [] }, userId);
  }
}
