import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdatePostDto {
  // ── snap 전용 ──
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  // ── article 전용 ──
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  body?: object;

  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
