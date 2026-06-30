import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ErrorCode } from '../errors/error-codes';

interface StandardErrorBody {
  statusCode: number;
  code: string;
  message: string;
  error: string;
  details?: string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): StandardErrorBody {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    // 비 HttpException → 500. 원본은 로깅만, 응답엔 노출하지 않는다.
    this.logger.error(
      exception instanceof Error ? exception.message : 'Unknown error',
      exception instanceof Error ? exception.stack : undefined,
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private fromHttpException(exception: HttpException): StandardErrorBody {
    const status = exception.getStatus();
    const res = exception.getResponse();
    const payload: Record<string, unknown> =
      typeof res === 'object' && res !== null
        ? (res as Record<string, unknown>)
        : { message: res };

    const rawMessage = payload.message ?? exception.message;
    const error =
      (payload.error as string | undefined) ?? this.statusText(status);

    // 검증 에러: message가 배열 → details로 분리, message는 string 표준화
    if (Array.isArray(rawMessage)) {
      return {
        statusCode: status,
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Validation failed',
        error,
        details: rawMessage as string[],
      };
    }

    // AppException 등 payload에 code가 있으면 그대로 사용, 없으면 error 텍스트 기반 폴백
    const code =
      (payload.code as string | undefined) ?? this.fallbackCode(error);

    const body: StandardErrorBody = {
      statusCode: status,
      code,
      message: (rawMessage as string) ?? this.statusText(status),
      error,
    };

    // ValidationPipe exceptionFactory 등에서 이미 details를 담아 던진 경우 보존
    if (Array.isArray(payload.details)) {
      body.details = payload.details as string[];
    }

    return body;
  }

  private fromPrisma(
    exception: Prisma.PrismaClientKnownRequestError,
  ): StandardErrorBody {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: 'Resource conflict',
          error: 'Conflict',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND,
          message: 'Resource not found',
          error: 'Not Found',
        };
      default:
        this.logger.error(
          `Unhandled Prisma error ${exception.code}: ${exception.message}`,
        );
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
          error: 'Internal Server Error',
        };
    }
  }

  /** "Not Found" → "NOT_FOUND" 폴백 code 생성 */
  private fallbackCode(error: string): string {
    return error
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private statusText(status: number): string {
    return HttpStatus[status] ? String(HttpStatus[status]) : 'Error';
  }
}
