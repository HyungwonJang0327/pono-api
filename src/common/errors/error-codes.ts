import { HttpStatus } from '@nestjs/common';

/**
 * 전 도메인 에러 코드 카탈로그.
 *
 * - code: SCREAMING_SNAKE 머신 식별자. 프론트가 i18n 키로 사용한다.
 * - 영어 message는 이 파일 한 곳에만 둔다(한국어 혼입 구조적 차단, 디버그/폴백용).
 *
 * 새 throw가 필요하면 여기에 코드를 추가하고 AppException.of(ErrorCode.X) 로 던진다.
 */
export enum ErrorCode {
  // --- 공통 ---
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // --- 인증 ---
  UNAUTHORIZED_MISSING_HEADER = 'UNAUTHORIZED_MISSING_HEADER',
  UNAUTHORIZED_INVALID_TOKEN = 'UNAUTHORIZED_INVALID_TOKEN',
  UNAUTHORIZED_FOLLOWING_FEED = 'UNAUTHORIZED_FOLLOWING_FEED',

  // --- 웹훅(Clerk) ---
  WEBHOOK_NOT_CONFIGURED = 'WEBHOOK_NOT_CONFIGURED',
  WEBHOOK_MISSING_HEADERS = 'WEBHOOK_MISSING_HEADERS',
  WEBHOOK_MISSING_BODY = 'WEBHOOK_MISSING_BODY',
  WEBHOOK_INVALID_SIGNATURE = 'WEBHOOK_INVALID_SIGNATURE',

  // --- 사용자 ---
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USERNAME_RESERVED = 'USERNAME_RESERVED',
  USERNAME_TAKEN = 'USERNAME_TAKEN',

  // --- 포스트 ---
  POST_NOT_FOUND = 'POST_NOT_FOUND',
  SNAP_IMAGE_REQUIRED = 'SNAP_IMAGE_REQUIRED',
  ARTICLE_TITLE_REQUIRED = 'ARTICLE_TITLE_REQUIRED',
  FORBIDDEN_POST_UPDATE = 'FORBIDDEN_POST_UPDATE',
  FORBIDDEN_POST_DELETE = 'FORBIDDEN_POST_DELETE',

  // --- 좋아요 ---
  ALREADY_LIKED = 'ALREADY_LIKED',

  // --- 댓글 ---
  COMMENT_NOT_FOUND = 'COMMENT_NOT_FOUND',
  PARENT_COMMENT_NOT_FOUND = 'PARENT_COMMENT_NOT_FOUND',
  COMMENT_DEPTH_EXCEEDED = 'COMMENT_DEPTH_EXCEEDED',
  FORBIDDEN_COMMENT_DELETE = 'FORBIDDEN_COMMENT_DELETE',

  // --- 팔로우 ---
  CANNOT_FOLLOW_SELF = 'CANNOT_FOLLOW_SELF',
  ALREADY_FOLLOWING = 'ALREADY_FOLLOWING',
}

export interface ErrorDefinition {
  status: HttpStatus;
  /** 영어 고정. 디버그/폴백용. */
  message: string;
}

export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  // --- 공통 ---
  [ErrorCode.VALIDATION_FAILED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Validation failed',
  },
  [ErrorCode.INTERNAL_ERROR]: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  },
  [ErrorCode.NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Resource not found',
  },
  [ErrorCode.CONFLICT]: {
    status: HttpStatus.CONFLICT,
    message: 'Resource conflict',
  },

  // --- 인증 ---
  [ErrorCode.UNAUTHORIZED_MISSING_HEADER]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Missing or invalid Authorization header',
  },
  [ErrorCode.UNAUTHORIZED_INVALID_TOKEN]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid or expired token',
  },
  [ErrorCode.UNAUTHORIZED_FOLLOWING_FEED]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Authentication required to view the following feed',
  },

  // --- 웹훅(Clerk) ---
  [ErrorCode.WEBHOOK_NOT_CONFIGURED]: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'CLERK_WEBHOOK_SECRET is not configured',
  },
  [ErrorCode.WEBHOOK_MISSING_HEADERS]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Missing svix headers',
  },
  [ErrorCode.WEBHOOK_MISSING_BODY]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Missing raw body',
  },
  [ErrorCode.WEBHOOK_INVALID_SIGNATURE]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid webhook signature',
  },

  // --- 사용자 ---
  [ErrorCode.USER_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'User not found',
  },
  [ErrorCode.USERNAME_RESERVED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'This username is not allowed',
  },
  [ErrorCode.USERNAME_TAKEN]: {
    status: HttpStatus.CONFLICT,
    message: 'This username is already taken',
  },

  // --- 포스트 ---
  [ErrorCode.POST_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Post not found',
  },
  [ErrorCode.SNAP_IMAGE_REQUIRED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A snap requires at least one image',
  },
  [ErrorCode.ARTICLE_TITLE_REQUIRED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'An article requires a title',
  },
  [ErrorCode.FORBIDDEN_POST_UPDATE]: {
    status: HttpStatus.FORBIDDEN,
    message: 'You do not have permission to update this post',
  },
  [ErrorCode.FORBIDDEN_POST_DELETE]: {
    status: HttpStatus.FORBIDDEN,
    message: 'You do not have permission to delete this post',
  },

  // --- 좋아요 ---
  [ErrorCode.ALREADY_LIKED]: {
    status: HttpStatus.CONFLICT,
    message: 'You already liked this post',
  },

  // --- 댓글 ---
  [ErrorCode.COMMENT_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Comment not found',
  },
  [ErrorCode.PARENT_COMMENT_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Parent comment not found',
  },
  [ErrorCode.COMMENT_DEPTH_EXCEEDED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'You cannot reply to a reply',
  },
  [ErrorCode.FORBIDDEN_COMMENT_DELETE]: {
    status: HttpStatus.FORBIDDEN,
    message: 'You do not have permission to delete this comment',
  },

  // --- 팔로우 ---
  [ErrorCode.CANNOT_FOLLOW_SELF]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'You cannot follow yourself',
  },
  [ErrorCode.ALREADY_FOLLOWING]: {
    status: HttpStatus.CONFLICT,
    message: 'You are already following this user',
  },
};
