import { IsString, IsNotEmpty } from 'class-validator';

export class PresignedUrlRequestDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;
}

export interface PresignedUrlResponseDto {
  uploadUrl: string;
  fileUrl: string;
}
