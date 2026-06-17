import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('handleUserCreated', () => {
    it('신규 유저를 생성한다', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 'user-1' });

      await service.handleUserCreated('clerk-123');

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          clerkId: 'clerk-123',
          username: null,
          tenantId: 'pono',
        },
      });
    });

    it('이미 존재하는 유저면 생성하지 않는다', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await service.handleUserCreated('clerk-123');

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('handleUserDeleted', () => {
    it('유저를 삭제한다', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.user.delete.mockResolvedValue({});

      await service.handleUserDeleted('clerk-123');

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { clerkId: 'clerk-123' },
      });
    });

    it('존재하지 않는 유저는 삭제를 시도하지 않는다', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await service.handleUserDeleted('clerk-999');

      expect(mockPrismaService.user.delete).not.toHaveBeenCalled();
    });
  });
});
