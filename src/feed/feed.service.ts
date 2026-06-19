import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractExcerpt } from '../common/utils/extract-excerpt';
import type {
  FeedItemDto,
  FeedResponseDto,
  ImageDto,
} from './dto/feed-response.dto';
import type { Prisma } from '@prisma/client';

const TENANT_ID = 'pono';

interface CursorParsed {
  date: Date;
  id: string;
}

function parseCursor(cursor: string): CursorParsed {
  const idx = cursor.indexOf('_');
  return {
    date: new Date(cursor.slice(0, idx)),
    id: cursor.slice(idx + 1),
  };
}

function buildCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}_${id}`;
}

type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    author: true;
    _count: { select: { likes: true } };
    likes: true;
  };
}>;

function mapToFeedItem(
  post: PostWithRelations,
  userId: string | null,
): FeedItemDto {
  const author = {
    id: post.author.id,
    username: post.author.username,
    avatar: post.author.avatar,
  };

  const likeCount = post._count.likes;
  const likedByMe = userId
    ? post.likes.some((l) => l.userId === userId)
    : false;

  if (post.type === 'snap') {
    return {
      id: post.id,
      type: 'snap',
      createdAt: post.createdAt,
      author,
      images: (post.images as ImageDto[] | null) ?? [],
      caption: post.caption,
      likeCount,
      likedByMe,
    };
  }

  return {
    id: post.id,
    type: 'article',
    createdAt: post.createdAt,
    author,
    title: post.title,
    excerpt: extractExcerpt(post.body),
    coverImage: post.coverImage,
    readingTime: post.readingTime,
    likeCount,
    likedByMe,
  };
}

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendedFeed(
    userId: string | null,
    cursor: string | undefined,
    limit: number,
  ): Promise<FeedResponseDto> {
    const where: Prisma.PostWhereInput = {
      tenantId: TENANT_ID,
      isDraft: false,
    };

    if (cursor) {
      const { date, id } = parseCursor(cursor);
      where.OR = [
        { createdAt: { lt: date } },
        { createdAt: date, id: { lt: id } },
      ];
    }

    const likesFilter: Prisma.LikeWhereInput | undefined = userId
      ? { userId }
      : undefined;

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        author: true,
        _count: { select: { likes: true } },
        likes: likesFilter ? { where: likesFilter } : false,
      },
    });

    return this.buildResponse(posts, userId, limit);
  }

  async getFollowingFeed(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<FeedResponseDto> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId, tenantId: TENANT_ID },
      select: { followingId: true },
    });

    const followingIds = follows.map((f) => f.followingId);

    const where: Prisma.PostWhereInput = {
      tenantId: TENANT_ID,
      isDraft: false,
      authorId: { in: followingIds },
    };

    if (cursor) {
      const { date, id } = parseCursor(cursor);
      where.OR = [
        { createdAt: { lt: date } },
        { createdAt: date, id: { lt: id } },
      ];
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        author: true,
        _count: { select: { likes: true } },
        likes: { where: { userId } },
      },
    });

    return this.buildResponse(posts, userId, limit);
  }

  private buildResponse(
    posts: PostWithRelations[],
    userId: string | null,
    limit: number,
  ): FeedResponseDto {
    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit).map((p) => mapToFeedItem(p, userId));

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? buildCursor(lastItem.createdAt, lastItem.id) : null;

    return { items, nextCursor, hasMore };
  }
}
