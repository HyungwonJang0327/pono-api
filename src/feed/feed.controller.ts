import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { FeedService } from './feed.service';
import { FeedQueryDto, FeedTab } from './dto/feed-query.dto';
import { Public } from '../common/decorators/public.decorator';
import type { FeedResponseDto } from './dto/feed-response.dto';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @Public()
  async getFeed(
    @Query() query: FeedQueryDto,
    @Req() req: Request,
  ): Promise<FeedResponseDto> {
    const user = (req as any).user as User | undefined;
    const userId = user?.id ?? null;

    const tab = query.tab ?? FeedTab.RECOMMENDED;
    const cursor = query.cursor;
    const limit = query.limit ?? 30;

    if (tab === FeedTab.FOLLOWING) {
      if (!userId) {
        throw new UnauthorizedException(
          '팔로잉 탭은 로그인 후 이용할 수 있습니다.',
        );
      }
      return this.feedService.getFollowingFeed(userId, cursor, limit);
    }

    return this.feedService.getRecommendedFeed(userId, cursor, limit);
  }
}
