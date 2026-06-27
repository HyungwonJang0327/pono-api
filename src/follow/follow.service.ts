import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

export interface FollowUserDto {
  id: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  isFollowedByMe: boolean;
  followerCount: number;
  recentActivity: { type: 'article' | 'snap'; daysAgo: number } | null;
}

const TENANT_ID = 'pono';

@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(
    followerId: string,
    targetUserId: string,
  ): Promise<{ followingId: string }> {
    if (followerId === targetUserId) {
      throw new BadRequestException('자기 자신을 팔로우할 수 없습니다');
    }

    const existing = await this.prisma.follow.findFirst({
      where: { followerId, followingId: targetUserId, tenantId: TENANT_ID },
    });

    if (existing) {
      throw new ConflictException('이미 팔로우 중입니다');
    }

    await this.prisma.follow.create({
      data: { followerId, followingId: targetUserId, tenantId: TENANT_ID },
    });

    return { followingId: targetUserId };
  }

  async unfollow(
    followerId: string,
    targetUserId: string,
  ): Promise<{ followingId: string }> {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId: targetUserId, tenantId: TENANT_ID },
    });

    return { followingId: targetUserId };
  }

  async getFollowers(
    username: string,
    requestUser: User | null,
  ): Promise<FollowUserDto[]> {
    const target = await this.prisma.user.findFirst({
      where: { username, tenantId: TENANT_ID },
    });
    if (!target) throw new NotFoundException('존재하지 않는 사용자입니다');

    const rows = await this.prisma.follow.findMany({
      where: { followingId: target.id, tenantId: TENANT_ID },
      include: { follower: true },
    });

    const userIds = rows.map((r) => r.follower.id);
    const [followedByMeSet, followerCountMap, recentActivityMap] =
      await Promise.all([
        this.getFollowedByMeSet(requestUser, userIds),
        this.getFollowerCountMap(userIds),
        this.getRecentActivityMap(userIds),
      ]);

    return rows.map((r) => ({
      id: r.follower.id,
      username: r.follower.username,
      avatar: r.follower.avatar,
      bio: r.follower.bio,
      isFollowedByMe: followedByMeSet.has(r.follower.id),
      followerCount: followerCountMap.get(r.follower.id) ?? 0,
      recentActivity: recentActivityMap.get(r.follower.id) ?? null,
    }));
  }

  async getFollowing(
    username: string,
    requestUser: User | null,
  ): Promise<FollowUserDto[]> {
    const target = await this.prisma.user.findFirst({
      where: { username, tenantId: TENANT_ID },
    });
    if (!target) throw new NotFoundException('존재하지 않는 사용자입니다');

    const rows = await this.prisma.follow.findMany({
      where: { followerId: target.id, tenantId: TENANT_ID },
      include: { following: true },
    });

    const userIds = rows.map((r) => r.following.id);
    const [followedByMeSet, followerCountMap, recentActivityMap] =
      await Promise.all([
        this.getFollowedByMeSet(requestUser, userIds),
        this.getFollowerCountMap(userIds),
        this.getRecentActivityMap(userIds),
      ]);

    return rows.map((r) => ({
      id: r.following.id,
      username: r.following.username,
      avatar: r.following.avatar,
      bio: r.following.bio,
      isFollowedByMe: followedByMeSet.has(r.following.id),
      followerCount: followerCountMap.get(r.following.id) ?? 0,
      recentActivity: recentActivityMap.get(r.following.id) ?? null,
    }));
  }

  private async getFollowerCountMap(
    userIds: string[],
  ): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.prisma.follow.groupBy({
      by: ['followingId'],
      where: { followingId: { in: userIds }, tenantId: TENANT_ID },
      _count: { followingId: true },
    });

    return new Map(rows.map((r) => [r.followingId, r._count.followingId]));
  }

  private async getRecentActivityMap(
    userIds: string[],
  ): Promise<Map<string, { type: 'article' | 'snap'; daysAgo: number }>> {
    if (userIds.length === 0) return new Map();

    const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: { in: userIds },
        createdAt: { gte: since },
        tenantId: TENANT_ID,
      },
      orderBy: { createdAt: 'desc' },
      select: { authorId: true, type: true, createdAt: true },
    });

    const map = new Map<string, { type: 'article' | 'snap'; daysAgo: number }>();
    for (const post of posts) {
      if (!map.has(post.authorId)) {
        const daysAgo = Math.floor(
          (Date.now() - post.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        );
        map.set(post.authorId, {
          type: post.type as 'article' | 'snap',
          daysAgo,
        });
      }
    }
    return map;
  }

  private async getFollowedByMeSet(
    requestUser: User | null,
    targetIds: string[],
  ): Promise<Set<string>> {
    if (!requestUser || targetIds.length === 0) return new Set();

    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: requestUser.id,
        followingId: { in: targetIds },
        tenantId: TENANT_ID,
      },
      select: { followingId: true },
    });

    return new Set(rows.map((r) => r.followingId));
  }
}
