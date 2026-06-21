export interface PostAuthorDto {
  id: string;
  username: string | null;
  avatar: string | null;
}

export interface PostImageDto {
  url: string;
  width: number;
  height: number;
}

export interface SnapDetailDto {
  id: string;
  type: 'snap';
  author: PostAuthorDto;
  images: PostImageDto[];
  caption: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleDetailDto {
  id: string;
  type: 'article';
  author: PostAuthorDto;
  title: string;
  body: object;
  coverImage: string | null;
  readingTime: number;
  isDraft: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PostDetailDto = SnapDetailDto | ArticleDetailDto;
