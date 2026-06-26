import { IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MaxLength(200)
  body: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
