import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (isPublic) {
      // Public 라우트에서도 토큰이 있으면 req.user 세팅 (선택적 인증)
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const secretKey =
          this.configService.get<string>('CLERK_SECRET_KEY') ?? '';
        try {
          const payload = await verifyToken(token, { secretKey });
          const user = await this.prisma.user.findUnique({
            where: { clerkId: payload.sub, tenantId: 'pono' },
          });
          if (user) (request as any).user = user;
        } catch {
          // 토큰 검증 실패해도 Public 라우트이므로 통과
        }
      }
      return true;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppException.of(ErrorCode.UNAUTHORIZED_MISSING_HEADER);
    }

    const token = authHeader.slice(7);
    const secretKey =
      this.configService.get<string>('CLERK_SECRET_KEY') ?? '';

    let clerkId: string;
    try {
      const payload = await verifyToken(token, { secretKey });
      clerkId = payload.sub;
    } catch {
      throw AppException.of(ErrorCode.UNAUTHORIZED_INVALID_TOKEN);
    }

    // Clerk JWT 검증이 통과했으면 유효한 유저임.
    // 웹훅 타이밍 갭으로 DB row가 없을 수 있으므로 upsert로 보장.
    const user = await this.prisma.user.upsert({
      where: { clerkId },
      create: { clerkId, tenantId: 'pono', username: null },
      update: {},
    });

    (request as any).user = user;
    return true;
  }
}
