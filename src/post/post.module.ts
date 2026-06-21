import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { S3Service } from './s3.service';

@Module({
  controllers: [PostController],
  providers: [PostService, S3Service],
})
export class PostModule {}
