import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
