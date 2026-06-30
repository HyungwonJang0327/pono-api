import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User, Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { UpdateUserDto, RESERVED_USERNAMES } from './dto/update-user.dto';
import { UserPostsQueryDto } from './dto/user-posts-query.dto';
import { extractExcerpt } from '../common/utils/extract-excerpt';
import type { ImageDto } from '../feed/dto/feed-response.dto';

const TENANT_ID = 'pono';
const DEFAULT_LIMIT = 30;

export interface SnapSummaryDto {
  id: string;
  type: 'snap';
  images: ImageDto[];
  caption: string | null;
  likeCount: number;
  createdAt: Date;
}

export interface ArticleSummaryDto {
  id: string;
  type: 'article';
  title: string | null;
  excerpt: string;
  coverImage: string | null;
  readingTime: number | null;
  isDraft: boolean;
  likeCount: number;
  createdAt: Date;
}

export interface UserPostsResponseDto {
  items: (SnapSummaryDto | ArticleSummaryDto)[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UserProfileDto {
  id: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  locale: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: Date;
}

export interface UserPublicProfileDto {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowedByMe: boolean;
  isOwnedByMe: boolean;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: User): Promise<UserProfileDto> {
    const result = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id, tenantId: TENANT_ID },
      include: {
        _count: {
          select: {
            followers: true,
            following: true,
            posts: {
              where: { isDraft: false },
            },
          },
        },
      },
    });

    return {
      id: result.id,
      username: result.username,
      avatar: result.avatar,
      bio: result.bio,
      locale: result.locale,
      followerCount: result._count.followers,
      followingCount: result._count.following,
      postCount: result._count.posts,
      createdAt: result.createdAt,
    };
  }

  async updateMe(user: User, dto: UpdateUserDto): Promise<UserProfileDto> {
    if (dto.username !== undefined) {
      if (RESERVED_USERNAMES.includes(dto.username)) {
        throw AppException.of(ErrorCode.USERNAME_RESERVED);
      }

      const existing = await this.prisma.user.findFirst({
        where: {
          username: dto.username,
          tenantId: TENANT_ID,
          NOT: { id: user.id },
        },
      });
      if (existing) {
        throw AppException.of(ErrorCode.USERNAME_TAKEN);
      }
    }

    await this.prisma.user.update({
      where: { id: user.id, tenantId: TENANT_ID },
      data: {
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
      },
    });

    return this.getMe({ ...user, ...dto } as User);
  }

  async getPublicProfile(
    username: string,
    requestingUserId: string | null,
  ): Promise<UserPublicProfileDto> {
    const result = await this.prisma.user.findFirst({
      where: { username, tenantId: TENANT_ID },
      include: {
        _count: {
          select: {
            followers: true,
            following: true,
            posts: { where: { isDraft: false } },
          },
        },
      },
    });

    if (!result) {
      throw AppException.of(ErrorCode.USER_NOT_FOUND);
    }

    let isFollowedByMe = false;
    if (requestingUserId) {
      const follow = await this.prisma.follow.findFirst({
        where: {
          followerId: requestingUserId,
          followingId: result.id,
          tenantId: TENANT_ID,
        },
      });
      isFollowedByMe = follow !== null;
    }

    const isOwnedByMe = requestingUserId !== null && requestingUserId === result.id;

    return {
      id: result.id,
      username: result.username!,
      avatar: result.avatar,
      bio: result.bio,
      followerCount: result._count.followers,
      followingCount: result._count.following,
      postCount: result._count.posts,
      isFollowedByMe,
      isOwnedByMe,
    };
  }

  async getUserPosts(
    username: string,
    query: UserPostsQueryDto,
  ): Promise<UserPostsResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { username, tenantId: TENANT_ID },
      select: { id: true },
    });

    if (!user) {
      throw AppException.of(ErrorCode.USER_NOT_FOUND);
    }

    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.PostWhereInput = {
      authorId: user.id,
      tenantId: TENANT_ID,
      type: query.type,
      isDraft: false,
    };

    if (query.cursor) {
      const idx = query.cursor.indexOf('_');
      const date = new Date(query.cursor.slice(0, idx));
      const id = query.cursor.slice(idx + 1);
      where.OR = [
        { createdAt: { lt: date } },
        { createdAt: date, id: { lt: id } },
      ];
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        type: true,
        images: true,
        caption: true,
        title: true,
        body: true,
        coverImage: true,
        readingTime: true,
        isDraft: true,
        createdAt: true,
        _count: { select: { likes: true } },
      },
    });

    const hasMore = posts.length > limit;
    const slice = posts.slice(0, limit);

    const items: (SnapSummaryDto | ArticleSummaryDto)[] = slice.map((p) => {
      if (p.type === 'snap') {
        return {
          id: p.id,
          type: 'snap' as const,
          images: (p.images as ImageDto[] | null) ?? [],
          caption: p.caption,
          likeCount: p._count.likes,
          createdAt: p.createdAt,
        };
      }
      return {
        id: p.id,
        type: 'article' as const,
        title: p.title,
        excerpt: extractExcerpt(p.body),
        coverImage: p.coverImage,
        readingTime: p.readingTime,
        isDraft: p.isDraft,
        likeCount: p._count.likes,
        createdAt: p.createdAt,
      };
    });

    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? `${last.createdAt.toISOString()}_${last.id}`
        : null;

    return { items, nextCursor, hasMore };
  }
}
