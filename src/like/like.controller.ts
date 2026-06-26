import {
  Controller,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { LikeService } from './like.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('likes')
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post(':postId')
  @HttpCode(HttpStatus.OK)
  async addLike(
    @Param('postId') postId: string,
    @CurrentUser() user: User,
  ) {
    return this.likeService.addLike(postId, user.id);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  async removeLike(
    @Param('postId') postId: string,
    @CurrentUser() user: User,
  ) {
    return this.likeService.removeLike(postId, user.id);
  }
}
