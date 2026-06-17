import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  username: null,
  avatar: null,
  bio: null,
  tenantId: 'pono',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrismaService = {
  user: {
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('UserProfileDto를 반환한다', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        ...mockUser,
        _count: { followers: 5, following: 3, posts: 10 },
      });

      const result = await service.getMe(mockUser as any);

      expect(result).toEqual({
        id: 'user-1',
        username: null,
        avatar: null,
        bio: null,
        followerCount: 5,
        followingCount: 3,
        postCount: 10,
        createdAt: mockUser.createdAt,
      });
    });
  });

  describe('updateMe', () => {
    it('username을 정상적으로 업데이트한다', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        ...mockUser,
        username: 'newname',
        _count: { followers: 0, following: 0, posts: 0 },
      });

      const result = await service.updateMe(mockUser as any, {
        username: 'newname',
      });

      expect(result.username).toBe('newname');
    });

    it('예약어 username은 BadRequestException을 던진다', async () => {
      await expect(
        service.updateMe(mockUser as any, { username: 'explore' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('중복 username은 ConflictException을 던진다', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'other-user' });

      await expect(
        service.updateMe(mockUser as any, { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('bio만 업데이트한다', async () => {
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        ...mockUser,
        bio: '안녕하세요',
        _count: { followers: 0, following: 0, posts: 0 },
      });

      const result = await service.updateMe(mockUser as any, {
        bio: '안녕하세요',
      });

      expect(result.bio).toBe('안녕하세요');
      expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled();
    });
  });
});
