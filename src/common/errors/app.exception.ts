import { HttpException } from '@nestjs/common';
import { ERROR_DEFINITIONS, ErrorCode } from './error-codes';

export interface AppExceptionResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
}

/**
 * 카탈로그(ErrorCode) 기반 도메인 예외.
 * 서비스 레이어에서 `throw AppException.of(ErrorCode.POST_NOT_FOUND)` 형태로 사용한다.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    const def = ERROR_DEFINITIONS[code];
    const response: AppExceptionResponse = {
      statusCode: def.status,
      code,
      message: def.message,
    };
    super(response, def.status);
    this.code = code;
  }

  static of(code: ErrorCode): AppException {
    return new AppException(code);
  }
}
