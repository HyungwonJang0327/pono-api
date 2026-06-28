import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  username: null,
  avatar: null,
  bio: null,
  locale: 'ko',
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
  follow: {
    findFirst: jest.fn(),
  },
  post: {
    findMany: jest.fn(),
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
        locale: 'ko',
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

    it('locale을 업데이트하고 반환한다', async () => {
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        ...mockUser,
        locale: 'en',
        _count: { followers: 0, following: 0, posts: 0 },
      });

      const result = await service.updateMe(mockUser as any, { locale: 'en' });

      expect(result.locale).toBe('en');
      const updateData = mockPrismaService.user.update.mock.calls[0][0].data;
      expect(updateData.locale).toBe('en');
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

  describe('getPublicProfile', () => {
    const targetUser = {
      id: 'user-2',
      username: 'johndoe',
      avatar: null,
      bio: null,
      tenantId: 'pono',
      _count: { followers: 10, following: 5, posts: 3 },
    };

    it('존재하는 username → UserPublicProfileDto를 반환한다', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(targetUser);
      mockPrismaService.follow.findFirst.mockResolvedValue(null);

      const result = await service.getPublicProfile('johndoe', 'user-1');

      expect(result).toEqual({
        id: 'user-2',
        username: 'johndoe',
        avatar: null,
        bio: null,
        followerCount: 10,
        followingCount: 5,
        postCount: 3,
        isFollowedByMe: false,
        isOwnedByMe: false,
      });
    });

    it('존재하지 않는 username → NotFoundException을 던진다', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicProfile('notexist', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('비로그인(requestingUserId null) → isFollowedByMe: false', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(targetUser);

      const result = await service.getPublicProfile('johndoe', null);

      expect(result.isFollowedByMe).toBe(false);
      expect(mockPrismaService.follow.findFirst).not.toHaveBeenCalled();
    });

    it('로그인 + 팔로우 중 → isFollowedByMe: true', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(targetUser);
      mockPrismaService.follow.findFirst.mockResolvedValue({ id: 'follow-1' });

      const result = await service.getPublicProfile('johndoe', 'user-1');

      expect(result.isFollowedByMe).toBe(true);
    });

    it('로그인 + 미팔로우 → isFollowedByMe: false', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(targetUser);
      mockPrismaService.follow.findFirst.mockResolvedValue(null);

      const result = await service.getPublicProfile('johndoe', 'user-1');

      expect(result.isFollowedByMe).toBe(false);
    });

    it('본인 프로필 조회(requestingUserId === user.id) → isOwnedByMe: true', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(targetUser);
      mockPrismaService.follow.findFirst.mockResolvedValue(null);

      const result = await service.getPublicProfile('johndoe', 'user-2');

      expect(result.isOwnedByMe).toBe(true);
    });

    it('타인 프로필 조회(requestingUserId !== user.id) → isOwnedByMe: false', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(targetUser);
      mockPrismaService.follow.findFirst.mockResolvedValue(null);

      const result = await service.getPublicProfile('johndoe', 'user-1');

      expect(result.isOwnedByMe).toBe(false);
    });

    it('비로그인(requestingUserId null) → isOwnedByMe: false', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(targetUser);

      const result = await service.getPublicProfile('johndoe', null);

      expect(result.isOwnedByMe).toBe(false);
    });
  });

  describe('getUserPosts', () => {
    const makePost = (overrides: object) => ({
      id: 'post-1',
      type: 'snap',
      images: [],
      caption: null,
      title: null,
      body: null,
      coverImage: null,
      readingTime: null,
      isDraft: false,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      _count: { likes: 0 },
      ...overrides,
    });

    beforeEach(() => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'user-2' });
    });

    it('type=snap → snap 포스트만 반환한다', async () => {
      const snapPost = makePost({ id: 'snap-1', type: 'snap' });
      mockPrismaService.post.findMany.mockResolvedValue([snapPost]);

      const result = await service.getUserPosts('johndoe', { type: 'snap' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('snap');
    });

    it('type=article → article 포스트만 반환한다', async () => {
      const articlePost = makePost({
        id: 'article-1',
        type: 'article',
        title: '제목',
        body: { type: 'doc', content: [] },
      });
      mockPrismaService.post.findMany.mockResolvedValue([articlePost]);

      const result = await service.getUserPosts('johndoe', { type: 'article' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('article');
    });

    it('isDraft: true 포스트는 포함하지 않는다', async () => {
      // getUserPosts는 where.isDraft: false 고정 → Prisma에 전달만 확인
      mockPrismaService.post.findMany.mockResolvedValue([]);

      await service.getUserPosts('johndoe', {});

      const whereArg = mockPrismaService.post.findMany.mock.calls[0][0].where;
      expect(whereArg.isDraft).toBe(false);
    });

    it('빈 결과 → { items: [], nextCursor: null, hasMore: false }', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([]);

      const result = await service.getUserPosts('johndoe', {});

      expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
    });
  });
});
