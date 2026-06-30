import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';

const TENANT_ID = 'pono';

@Injectable()
export class LikeService {
  constructor(private readonly prisma: PrismaService) {}

  async addLike(
    postId: string,
    userId: string,
  ): Promise<{ postId: string; likeCount: number }> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, tenantId: TENANT_ID },
    });
    if (!post) {
      throw AppException.of(ErrorCode.POST_NOT_FOUND);
    }

    const existing = await this.prisma.like.findFirst({
      where: { postId, userId, tenantId: TENANT_ID },
    });
    if (existing) {
      throw AppException.of(ErrorCode.ALREADY_LIKED);
    }

    await this.prisma.like.create({
      data: { postId, userId, tenantId: TENANT_ID },
    });

    const likeCount = await this.prisma.like.count({
      where: { postId, tenantId: TENANT_ID },
    });

    return { postId, likeCount };
  }

  async removeLike(
    postId: string,
    userId: string,
  ): Promise<{ postId: string; likeCount: number }> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, tenantId: TENANT_ID },
    });
    if (!post) {
      throw AppException.of(ErrorCode.POST_NOT_FOUND);
    }

    const existing = await this.prisma.like.findFirst({
      where: { postId, userId, tenantId: TENANT_ID },
    });
    if (!existing) {
      const likeCount = await this.prisma.like.count({
        where: { postId, tenantId: TENANT_ID },
      });
      return { postId, likeCount };
    }

    await this.prisma.like.delete({ where: { id: existing.id } });

    const likeCount = await this.prisma.like.count({
      where: { postId, tenantId: TENANT_ID },
    });

    return { postId, likeCount };
  }
}
