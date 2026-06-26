import { Controller, Post, Delete, Param } from '@nestjs/common';
import { FollowService } from './follow.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
}
