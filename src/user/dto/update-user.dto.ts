import {
  IsString,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export const RESERVED_USERNAMES = [
  'explore',
  'write',
  'login',
  'signup',
  'api',
  'admin',
  'onboarding',
  'feed',
  'settings',
  'logout',
];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'username은 영문 소문자, 숫자, 언더스코어만 사용 가능합니다',
  })
  username?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
