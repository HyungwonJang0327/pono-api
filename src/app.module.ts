import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PostModule } from './post/post.module';
import { FeedModule } from './feed/feed.module';
import { FollowModule } from './follow/follow.module';
import { LikeModule } from './like/like.module';
import { CommentModule } from './comment/comment.module';

@Module({
  imports: [AuthModule, UserModule, PostModule, FeedModule, FollowModule, LikeModule, CommentModule],
})
export class AppModule {}
