import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FollowService } from './follow.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  follow: {
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('FollowService', () => {
  let service: FollowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FollowService>(FollowService);
    jest.clearAllMocks();
  });

  describe('follow', () => {
    it('정상 팔로우 → Follow 레코드를 생성하고 followingId를 반환한다', async () => {
      mockPrismaService.follow.findFirst.mockResolvedValue(null);
      mockPrismaService.follow.create.mockResolvedValue({});

      const result = await service.follow('user-1', 'user-2');

      expect(mockPrismaService.follow.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ followingId: 'user-2' });
    });

    it('자기 자신 팔로우 → BadRequestException을 던진다', async () => {
      await expect(service.follow('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.follow.findFirst).not.toHaveBeenCalled();
    });

    it('이미 팔로우 중 → ConflictException을 던진다', async () => {
      mockPrismaService.follow.findFirst.mockResolvedValue({ id: 'follow-1' });

      await expect(service.follow('user-1', 'user-2')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.follow.create).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('정상 언팔로우 → Follow 레코드를 삭제하고 followingId를 반환한다', async () => {
      mockPrismaService.follow.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unfollow('user-1', 'user-2');

      expect(mockPrismaService.follow.deleteMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ followingId: 'user-2' });
    });

    it('팔로우 관계가 없어도 에러 없이 성공한다 (멱등)', async () => {
      mockPrismaService.follow.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unfollow('user-1', 'user-2')).resolves.toEqual({
        followingId: 'user-2',
      });
    });
  });
});
