import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPosts = [
  {
    id: 'post1',
    type: 'snap',
    tenantId: 'pono',
    isDraft: false,
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    updatedAt: new Date('2026-06-15T10:00:00.000Z'),
    authorId: 'user1',
    images: [{ url: 'https://s3.example.com/img1.jpg', width: 800, height: 600 }],
    caption: '테스트 스냅',
    title: null,
    body: null,
    coverImage: null,
    readingTime: null,
    author: { id: 'user1', username: 'testuser', avatar: null },
    _count: { likes: 5 },
    likes: [],
  },
  {
    id: 'post2',
    type: 'article',
    tenantId: 'pono',
    isDraft: false,
    createdAt: new Date('2026-06-14T10:00:00.000Z'),
    updatedAt: new Date('2026-06-14T10:00:00.000Z'),
    authorId: 'user2',
    images: null,
    caption: null,
    title: '테스트 아티클',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '아티클 본문 내용입니다.' }],
        },
      ],
    },
    coverImage: 'https://s3.example.com/cover.jpg',
    readingTime: 3,
    author: { id: 'user2', username: 'writer', avatar: 'https://s3.example.com/avatar.jpg' },
    _count: { likes: 10 },
    likes: [],
  },
];

describe('FeedService', () => {
  let service: FeedService;
  let prisma: { post: { findMany: jest.Mock }; follow: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      post: { findMany: jest.fn() },
      follow: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  describe('getRecommendedFeed', () => {
    it('비로그인 시 likedByMe는 항상 false', async () => {
      prisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await service.getRecommendedFeed(null, undefined, 30);

      expect(result.items.every((item) => item.likedByMe === false)).toBe(true);
    });

    it('스냅 아이템 형태 검증', async () => {
      prisma.post.findMany.mockResolvedValue([mockPosts[0]]);

      const result = await service.getRecommendedFeed(null, undefined, 30);

      const snap = result.items[0] as any;
      expect(snap.type).toBe('snap');
      expect(snap.images).toHaveLength(1);
      expect(snap.caption).toBe('테스트 스냅');
      expect(snap.likeCount).toBe(5);
    });

    it('아티클 아이템에 excerpt 포함', async () => {
      prisma.post.findMany.mockResolvedValue([mockPosts[1]]);

      const result = await service.getRecommendedFeed(null, undefined, 30);

      const article = result.items[0] as any;
      expect(article.type).toBe('article');
      expect(article.excerpt).toBe('아티클 본문 내용입니다.');
      expect(article.title).toBe('테스트 아티클');
      expect(article.likeCount).toBe(10);
    });

    it('limit+1 개 결과가 오면 hasMore=true, nextCursor 반환', async () => {
      // limit=1, 결과 2개 → hasMore true
      prisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await service.getRecommendedFeed(null, undefined, 1);

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(result.items).toHaveLength(1);
    });

    it('결과가 limit 이하이면 hasMore=false, nextCursor=null', async () => {
      prisma.post.findMany.mockResolvedValue([mockPosts[0]]);

      const result = await service.getRecommendedFeed(null, undefined, 30);

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('nextCursor 형식이 isoDate_postId', async () => {
      prisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await service.getRecommendedFeed(null, undefined, 1);

      const cursor = result.nextCursor!;
      const underscoreIdx = cursor.indexOf('_');
      const datePart = cursor.slice(0, underscoreIdx);
      const idPart = cursor.slice(underscoreIdx + 1);

      expect(() => new Date(datePart)).not.toThrow();
      expect(idPart).toBe('post1');
    });

    it('로그인 유저가 좋아요한 포스트 likedByMe=true', async () => {
      const postWithLike = {
        ...mockPosts[0],
        likes: [{ userId: 'user-me', postId: 'post1' }],
      };
      prisma.post.findMany.mockResolvedValue([postWithLike]);

      const result = await service.getRecommendedFeed('user-me', undefined, 30);

      expect(result.items[0].likedByMe).toBe(true);
    });
  });

  describe('getFollowingFeed', () => {
    it('팔로잉 목록 기반으로 쿼리', async () => {
      prisma.follow.findMany.mockResolvedValue([
        { followingId: 'user2' },
      ]);
      prisma.post.findMany.mockResolvedValue([mockPosts[1]]);

      const result = await service.getFollowingFeed('user1', undefined, 30);

      expect(prisma.follow.findMany).toHaveBeenCalledWith({
        where: { followerId: 'user1', tenantId: 'pono' },
        select: { followingId: true },
      });
      expect(result.items).toHaveLength(1);
    });

    it('팔로잉이 없으면 빈 피드 반환', async () => {
      prisma.follow.findMany.mockResolvedValue([]);
      prisma.post.findMany.mockResolvedValue([]);

      const result = await service.getFollowingFeed('user1', undefined, 30);

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });
});
