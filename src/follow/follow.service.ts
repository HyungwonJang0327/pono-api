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

    const followedByMeSet = await this.getFollowedByMeSet(
      requestUser,
      rows.map((r) => r.follower.id),
    );

    return rows.map((r) => ({
      id: r.follower.id,
      username: r.follower.username,
      avatar: r.follower.avatar,
      bio: r.follower.bio,
      isFollowedByMe: followedByMeSet.has(r.follower.id),
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

    const followedByMeSet = await this.getFollowedByMeSet(
      requestUser,
      rows.map((r) => r.following.id),
    );

    return rows.map((r) => ({
      id: r.following.id,
      username: r.following.username,
      avatar: r.following.avatar,
      bio: r.following.bio,
      isFollowedByMe: followedByMeSet.has(r.following.id),
    }));
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
