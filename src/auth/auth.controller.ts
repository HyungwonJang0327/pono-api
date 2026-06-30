import { Controller, Post, Req, Headers, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'CLERK_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw AppException.of(ErrorCode.WEBHOOK_NOT_CONFIGURED);
    }

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw AppException.of(ErrorCode.WEBHOOK_MISSING_HEADERS);
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw AppException.of(ErrorCode.WEBHOOK_MISSING_BODY);
    }

    let event: { type: string; data: Record<string, any> };
    try {
      const wh = new Webhook(webhookSecret);
      event = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as { type: string; data: Record<string, any> };
    } catch {
      throw AppException.of(ErrorCode.WEBHOOK_INVALID_SIGNATURE);
    }

    switch (event.type) {
      case 'user.created':
        await this.authService.handleUserCreated(event.data.id as string, {
          imageUrl: event.data.image_url as string | null,
          email: (event.data.email_addresses as Array<{ email_address: string }>)?.[0]?.email_address ?? null,
          firstName: event.data.first_name as string | null,
          lastName: event.data.last_name as string | null,
          externalAccounts: event.data.external_accounts as unknown[] | null,
        });
        break;
      case 'user.deleted':
        await this.authService.handleUserDeleted(event.data.id as string);
        break;
      default:
        break;
    }

    return { received: true };
  }
}
