import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import type { User } from '@prisma/client';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@CurrentUser() user: User) {
    return this.userService.getMe(user);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    return this.userService.updateMe(user, dto);
  }

  @Public()
  @Get(':username')
  async getPublicProfile(
    @Param('username') username: string,
    @CurrentUser() user: User | undefined,
  ) {
    return this.userService.getPublicProfile(username, user?.id ?? null);
  }
}
