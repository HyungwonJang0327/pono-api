import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';
import { UpdateUserDto, RESERVED_USERNAMES } from './dto/update-user.dto';

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

export interface UserPublicProfileDto {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowedByMe: boolean;
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

  async updateMe(user: User, dto: UpdateUserDto): Promise<UserProfileDto> {
    if (dto.username !== undefined) {
      if (RESERVED_USERNAMES.includes(dto.username)) {
        throw new BadRequestException(
          `'${dto.username}'은 사용할 수 없는 username입니다`,
        );
      }

      const existing = await this.prisma.user.findFirst({
        where: {
          username: dto.username,
          tenantId: TENANT_ID,
          NOT: { id: user.id },
        },
      });
      if (existing) {
        throw new ConflictException('이미 사용 중인 username입니다');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id, tenantId: TENANT_ID },
      data: {
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
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
      throw new NotFoundException('존재하지 않는 사용자입니다');
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

    return {
      id: result.id,
      username: result.username!,
      avatar: result.avatar,
      bio: result.bio,
      followerCount: result._count.followers,
      followingCount: result._count.following,
      postCount: result._count.posts,
      isFollowedByMe,
    };
  }
}
