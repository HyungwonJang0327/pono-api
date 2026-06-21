import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsIn,
  ValidateIf,
  ValidateNested,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PostImageDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsNumber()
  @Min(1)
  width: number;

  @IsNumber()
  @Min(1)
  height: number;
}

export class CreatePostDto {
  @IsIn(['snap', 'article'])
  type: 'snap' | 'article';

  // ── snap 전용 필드 ──
  @ValidateIf((o: CreatePostDto) => o.type === 'snap')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PostImageDto)
  images?: PostImageDto[];

  @ValidateIf((o: CreatePostDto) => o.type === 'snap')
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  // ── article 전용 필드 ──
  @ValidateIf((o: CreatePostDto) => o.type === 'article')
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ValidateIf((o: CreatePostDto) => o.type === 'article')
  @IsOptional()
  body?: object;

  @ValidateIf((o: CreatePostDto) => o.type === 'article')
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ValidateIf((o: CreatePostDto) => o.type === 'article')
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
