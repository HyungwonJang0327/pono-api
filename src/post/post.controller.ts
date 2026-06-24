import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PresignedUrlRequestDto } from './dto/presigned-url.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

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

  @Get(':id')
  @Public()
  async getPostDetail(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user as User | undefined;
    const requestUser = user ? { id: user.id, clerkId: user.clerkId } : null;
    return this.postService.getPostDetail(id, requestUser);
  }

  @Patch(':id')
  async updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: User,
  ) {
    return this.postService.updatePost(id, dto, { id: user.id, clerkId: user.clerkId });
  }

  @Delete(':id')
  async deletePost(@Param('id') id: string, @CurrentUser() user: User) {
    return this.postService.deletePost(id, { id: user.id, clerkId: user.clerkId });
  }
}
