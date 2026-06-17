import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

const TENANT_ID = 'pono';

export interface UserProfileDto {
  id: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: Date;
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
      followerCount: result._count.followers,
      followingCount: result._count.following,
      postCount: result._count.posts,
      createdAt: result.createdAt,
    };
  }
}
