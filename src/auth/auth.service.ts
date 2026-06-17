import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TENANT_ID = 'pono';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async handleUserCreated(clerkId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkId },
    });
    if (existing) return;

    await this.prisma.user.create({
      data: {
        clerkId,
        username: null,
        tenantId: TENANT_ID,
      },
    });
  }

  async handleUserDeleted(clerkId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
    });
    if (!user) return;

    await this.prisma.user.delete({
      where: { clerkId },
    });
  }
}
