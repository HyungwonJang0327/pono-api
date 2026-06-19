export interface AuthorDto {
  id: string;
  username: string | null;
  avatar: string | null;
}

export interface ImageDto {
  url: string;
  width: number;
  height: number;
}

export interface SnapFeedItemDto {
  id: string;
  type: 'snap';
  createdAt: Date;
  author: AuthorDto;
  images: ImageDto[];
  caption: string | null;
  likeCount: number;
  likedByMe: boolean;
}

export interface ArticleFeedItemDto {
  id: string;
  type: 'article';
  createdAt: Date;
  author: AuthorDto;
  title: string | null;
  excerpt: string;
  coverImage: string | null;
  readingTime: number | null;
  likeCount: number;
  likedByMe: boolean;
}

export type FeedItemDto = SnapFeedItemDto | ArticleFeedItemDto;

export interface FeedResponseDto {
  items: FeedItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
