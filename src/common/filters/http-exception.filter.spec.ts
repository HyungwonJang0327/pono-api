import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { HttpExceptionFilter } from './http-exception.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  body?: unknown;
}

function createHost(): { host: ArgumentsHost; res: MockResponse } {
  const res: MockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  return { host, res };
}

describe('HttpExceptionFilter (회귀: 현행 동작 박제)', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('HttpException -> {statusCode, message, error} 형태로 응답한다', () => {
    const { host, res } = createHost();

    filter.catch(new NotFoundException('Post not found'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.body).toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Post not found',
      error: 'Not Found',
    });
  });

  it('비 HttpException -> 500 + Internal server error 로 고정한다', () => {
    const { host, res } = createHost();
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('boom'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.body).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });

    errorSpy.mockRestore();
  });

  it('일반 HttpException 의 error 텍스트를 그대로 보존한다', () => {
    const { host, res } = createHost();

    filter.catch(
      new HttpException(
        { statusCode: 418, message: "I'm a teapot", error: 'Teapot' },
        418,
      ),
      host,
    );

    expect(res.body).toMatchObject({
      statusCode: 418,
      message: "I'm a teapot",
      error: 'Teapot',
    });
  });
});

describe('HttpExceptionFilter (표준화: code·details·로깅·Prisma)', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('AppException -> 응답에 머신 식별자 code 를 포함한다', () => {
    const { host, res } = createHost();

    filter.catch(AppException.of(ErrorCode.POST_NOT_FOUND), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.body).toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      code: 'POST_NOT_FOUND',
      message: 'Post not found',
    });
  });

  it('검증 배열 -> message string 화 + details 분리 + VALIDATION_FAILED code', () => {
    const { host, res } = createHost();
    const validationError = new BadRequestException({
      statusCode: 400,
      message: ['caption must be a string', 'title should not be empty'],
      error: 'Bad Request',
    });

    filter.catch(validationError, host);

    const body = res.body as {
      code: string;
      message: unknown;
      details: unknown;
    };
    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.message).toBe('Validation failed');
    expect(body.details).toEqual([
      'caption must be a string',
      'title should not be empty',
    ]);
  });

  it('code 없는 일반 HttpException -> error 텍스트 기반 폴백 code 생성', () => {
    const { host, res } = createHost();

    filter.catch(new NotFoundException('Post not found'), host);

    expect((res.body as { code: string }).code).toBe('NOT_FOUND');
  });

  it('비 HttpException -> code:INTERNAL_ERROR + 원본을 Logger 로 로깅한다', () => {
    const { host, res } = createHost();
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('db exploded'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect((res.body as { code: string }).code).toBe('INTERNAL_ERROR');
    // 원본 메시지는 응답에 노출되지 않는다
    expect((res.body as { message: string }).message).toBe(
      'Internal server error',
    );
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain('db exploded');

    errorSpy.mockRestore();
  });

  it('Prisma P2002 -> 409 CONFLICT 로 매핑한다', () => {
    const { host, res } = createHost();
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.19.3' },
    );

    filter.catch(prismaError, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect((res.body as { code: string }).code).toBe('CONFLICT');
  });

  it('Prisma P2025 -> 404 NOT_FOUND 로 매핑한다', () => {
    const { host, res } = createHost();
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record to delete does not exist',
      { code: 'P2025', clientVersion: '6.19.3' },
    );

    filter.catch(prismaError, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect((res.body as { code: string }).code).toBe('NOT_FOUND');
  });
});
