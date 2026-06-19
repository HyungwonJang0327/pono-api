import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum FeedTab {
  RECOMMENDED = 'recommended',
  FOLLOWING = 'following',
}

export class FeedQueryDto {
  @IsOptional()
  @IsEnum(FeedTab)
  tab?: FeedTab = FeedTab.RECOMMENDED;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number = 30;
}
