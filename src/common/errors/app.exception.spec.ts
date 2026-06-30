import { HttpException } from '@nestjs/common';
import { AppException, AppExceptionResponse } from './app.exception';
import { ERROR_DEFINITIONS, ErrorCode } from './error-codes';

describe('AppException', () => {
  it('HttpException 을 상속한다', () => {
    expect(AppException.of(ErrorCode.POST_NOT_FOUND)).toBeInstanceOf(
      HttpException,
    );
  });

  it('모든 ErrorCode -> 카탈로그의 status/영어 message 로 매핑된다', () => {
    for (const code of Object.values(ErrorCode)) {
      const def = ERROR_DEFINITIONS[code];
      const ex = AppException.of(code);

      expect(ex.getStatus()).toBe(def.status);

      const payload = ex.getResponse() as AppExceptionResponse;
      expect(payload.statusCode).toBe(def.status);
      expect(payload.message).toBe(def.message);
      // 영어 고정: 한글이 섞이지 않았는지 가드
      expect(payload.message).not.toMatch(/[가-힣]/);
    }
  });

  it('payload 에 머신 식별자 code 를 포함한다', () => {
    const ex = AppException.of(ErrorCode.USER_NOT_FOUND);
    const payload = ex.getResponse() as AppExceptionResponse;

    expect(payload.code).toBe('USER_NOT_FOUND');
    expect(ex.code).toBe(ErrorCode.USER_NOT_FOUND);
  });
});
