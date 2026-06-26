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
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'username은 영문 대소문자와 숫자만 사용 가능합니다',
  })
  username?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bio?: string;
}
