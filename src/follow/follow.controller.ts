import { Controller, Post, Delete, Get, Param } from '@nestjs/common';
import { FollowService } from './follow.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { User } from '@prisma/client';

@Controller('follow')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':targetUserId')
  async follow(
    @CurrentUser() user: User,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.followService.follow(user.id, targetUserId);
  }

  @Delete(':targetUserId')
  async unfollow(
    @CurrentUser() user: User,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.followService.unfollow(user.id, targetUserId);
  }

  @Public()
  @Get(':username/followers')
  async getFollowers(
    @Param('username') username: string,
    @CurrentUser() user: User | null,
  ) {
    return this.followService.getFollowers(username, user ?? null);
  }

  @Public()
  @Get(':username/following')
  async getFollowing(
    @Param('username') username: string,
    @CurrentUser() user: User | null,
  ) {
    return this.followService.getFollowing(username, user ?? null);
  }
}
