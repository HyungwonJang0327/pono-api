import { ArgumentsHost, HttpStatus, ValidationError } from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-exception-factory';

function makeError(
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError {
  return { property, constraints, children } as ValidationError;
}

describe('validationExceptionFactory', () => {
  it('flattenValidationErrors 가 중첩 children 까지 평탄화한다', () => {
    const errors: ValidationError[] = [
      makeError('caption', { isString: 'caption must be a string' }),
      makeError('images', {}, [
        makeError('0', { isUrl: 'url must be a URL' }),
      ]),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      'caption must be a string',
      'url must be a URL',
    ]);
  });

  it('표준 검증 응답으로 던진다 (code/message/details)', () => {
    const ex = validationExceptionFactory([
      makeError('title', { isNotEmpty: 'title should not be empty' }),
    ]);
    const payload = ex.getResponse() as Record<string, unknown>;

    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(payload.code).toBe('VALIDATION_FAILED');
    expect(payload.message).toBe('Validation failed');
    expect(payload.details).toEqual(['title should not be empty']);
  });

  it('필터를 거친 최종 응답이 표준 1형태다', () => {
    const filter = new HttpExceptionFilter();
    let body: unknown;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((b: unknown) => {
        body = b;
        return res;
      }),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }),
    } as unknown as ArgumentsHost;

    const ex = validationExceptionFactory([
      makeError('caption', { isString: 'caption must be a string' }),
    ]);
    filter.catch(ex, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(body).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      error: 'Bad Request',
      details: ['caption must be a string'],
    });
  });
});
