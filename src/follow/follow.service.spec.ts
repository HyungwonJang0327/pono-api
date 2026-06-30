import { Test, TestingModule } from '@nestjs/testing';
import { FollowService } from './follow.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';

const mockPrismaService = {
  follow: {
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
  post: {
    findMany: jest.fn(),
  },
};

// ── 헬퍼: 유저 stub 생성 ─────────────────────────────────────
function makeUser(
  id: string,
  username: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    username,
    avatar: null,
    bio: null,
    clerkId: `clerk-${id}`,
    tenantId: 'pono',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

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
    jest.resetAllMocks();

    // 새 필드(followerCount, recentActivity) 관련 쿼리 기본 fallback
    mockPrismaService.follow.groupBy.mockResolvedValue([]);
    mockPrismaService.post.findMany.mockResolvedValue([]);
  });

  describe('follow', () => {
    it('정상 팔로우 → Follow 레코드를 생성하고 followingId를 반환한다', async () => {
      mockPrismaService.follow.findFirst.mockResolvedValue(null);
      mockPrismaService.follow.create.mockResolvedValue({});

      const result = await service.follow('user-1', 'user-2');

      expect(mockPrismaService.follow.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ followingId: 'user-2' });
    });

    it('자기 자신 팔로우 → CANNOT_FOLLOW_SELF AppException을 던진다', async () => {
      await expect(service.follow('user-1', 'user-1')).rejects.toThrow(
        AppException,
      );
      await expect(service.follow('user-1', 'user-1')).rejects.toHaveProperty(
        'code',
        ErrorCode.CANNOT_FOLLOW_SELF,
      );
      expect(mockPrismaService.follow.findFirst).not.toHaveBeenCalled();
    });

    it('이미 팔로우 중 → ALREADY_FOLLOWING AppException을 던진다', async () => {
      mockPrismaService.follow.findFirst.mockResolvedValue({ id: 'follow-1' });

      await expect(service.follow('user-1', 'user-2')).rejects.toThrow(
        AppException,
      );
      await expect(service.follow('user-1', 'user-2')).rejects.toHaveProperty(
        'code',
        ErrorCode.ALREADY_FOLLOWING,
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

  describe('getFollowers', () => {
    it('팔로워 목록을 정상 반환한다', async () => {
      const target = makeUser('user-target', 'targetuser');
      const follower1 = makeUser('user-1', 'alice');
      const follower2 = makeUser('user-2', 'bob');

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { follower: follower1 },
        { follower: follower2 },
      ]);

      const result = await service.getFollowers('targetuser', null);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'user-1', username: 'alice', isFollowedByMe: false });
      expect(result[1]).toMatchObject({ id: 'user-2', username: 'bob', isFollowedByMe: false });
    });

    it('요청자가 팔로워 중 한 명을 팔로우 중이면 isFollowedByMe: true', async () => {
      const target = makeUser('user-target', 'targetuser');
      const follower1 = makeUser('user-1', 'alice');

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { follower: follower1 },
      ]);
      // 요청자(user-me)가 user-1을 팔로우 중
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { followingId: 'user-1' },
      ]);

      const requestUser = makeUser('user-me', 'me');
      const result = await service.getFollowers('targetuser', requestUser as any);

      expect(result[0]).toMatchObject({ id: 'user-1', isFollowedByMe: true });
    });

    it('비로그인(requestUser: null) → isFollowedByMe 전부 false', async () => {
      const target = makeUser('user-target', 'targetuser');
      const follower1 = makeUser('user-1', 'alice');

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { follower: follower1 },
      ]);

      const result = await service.getFollowers('targetuser', null);

      expect(result[0].isFollowedByMe).toBe(false);
    });
  });

  describe('getFollowing', () => {
    it('팔로잉 목록을 정상 반환한다', async () => {
      const target = makeUser('user-target', 'targetuser');
      const following1 = makeUser('user-3', 'carol');

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { following: following1 },
      ]);

      const result = await service.getFollowing('targetuser', null);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'user-3', username: 'carol', isFollowedByMe: false });
    });

    it('존재하지 않는 username → USER_NOT_FOUND AppException을 던진다', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.getFollowing('ghost', null)).rejects.toThrow(
        AppException,
      );
      await expect(service.getFollowing('ghost', null)).rejects.toHaveProperty(
        'code',
        ErrorCode.USER_NOT_FOUND,
      );
    });
  });

  describe('followerCount / recentActivity', () => {
    it('followerCount가 각 유저에 올바르게 매핑된다', async () => {
      const target = makeUser('user-target', 'targetuser');
      const follower1 = makeUser('user-1', 'alice');
      const follower2 = makeUser('user-2', 'bob');

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { follower: follower1 },
        { follower: follower2 },
      ]);
      mockPrismaService.follow.groupBy.mockResolvedValue([
        { followingId: 'user-1', _count: { followingId: 3 } },
        { followingId: 'user-2', _count: { followingId: 7 } },
      ]);

      const result = await service.getFollowers('targetuser', null);

      expect(result[0]).toMatchObject({ id: 'user-1', followerCount: 3 });
      expect(result[1]).toMatchObject({ id: 'user-2', followerCount: 7 });
    });

    it('recentActivity: 10일 이내 게시물이 있으면 { type, daysAgo }를 반환한다', async () => {
      const target = makeUser('user-target', 'targetuser');
      const follower1 = makeUser('user-1', 'alice');

      const daysAgo2 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { follower: follower1 },
      ]);
      mockPrismaService.post.findMany.mockResolvedValue([
        { authorId: 'user-1', type: 'article', createdAt: daysAgo2 },
      ]);

      const result = await service.getFollowers('targetuser', null);

      expect(result[0].recentActivity).toEqual({ type: 'article', daysAgo: 2 });
    });

    it('recentActivity: 10일 초과 게시물만 있으면 null을 반환한다', async () => {
      const target = makeUser('user-target', 'targetuser');
      const follower1 = makeUser('user-1', 'alice');

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { follower: follower1 },
      ]);
      // post.findMany는 10일 이내만 필터하므로 빈 배열 반환 (beforeEach 기본값)

      const result = await service.getFollowers('targetuser', null);

      expect(result[0].recentActivity).toBeNull();
    });

    it('recentActivity: 게시물이 없으면 null을 반환한다', async () => {
      const target = makeUser('user-target', 'targetuser');
      const follower1 = makeUser('user-1', 'alice');

      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.follow.findMany.mockResolvedValueOnce([
        { follower: follower1 },
      ]);
      // post.findMany 빈 배열 (beforeEach 기본값)

      const result = await service.getFollowers('targetuser', null);

      expect(result[0].recentActivity).toBeNull();
    });
  });
});
