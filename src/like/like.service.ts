import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    const existing = await this.prisma.like.findFirst({
      where: { postId, userId, tenantId: TENANT_ID },
    });
    if (existing) {
      throw new ConflictException('이미 좋아요한 포스트입니다.');
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
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
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
