import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PresignedUrlRequestDto } from './dto/presigned-url.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  async getPresignedUrl(
    @Body() dto: PresignedUrlRequestDto,
    @CurrentUser() _user: User,
  ) {
    return this.postService.createPresignedUrl(dto.filename, dto.contentType);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: User,
  ) {
    return this.postService.createPost(dto, user.id);
  }
}
