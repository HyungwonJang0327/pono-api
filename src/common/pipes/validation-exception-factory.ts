import {
  BadRequestException,
  HttpStatus,
  ValidationError,
} from '@nestjs/common';
import { ErrorCode } from '../errors/error-codes';

/** 중첩 ValidationError 트리를 평탄한 메시지 배열로 변환 */
export function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children));
    }
  }
  return messages;
}

/**
 * ValidationPipe 의 exceptionFactory.
 * 검증 실패를 표준 에러 응답(code:VALIDATION_FAILED, message string, details 배열)으로 던진다.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Validation failed',
    error: 'Bad Request',
    details: flattenValidationErrors(errors),
  });
}
