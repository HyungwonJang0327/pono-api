import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';

const mockPrismaService = {
  post: {
    findFirst: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    authorId: 'user-id-1',
    body: '댓글 내용',
    parentId: null,
    postId: 'post-id-1',
    tenantId: 'pono',
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
    author: { id: 'user-id-1', username: 'testuser', avatar: null },
    replies: [],
    ...overrides,
  };
}

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    jest.clearAllMocks();
  });

  describe('getComments — isOwnedByMe', () => {
    beforeEach(() => {
      mockPrismaService.post.findFirst.mockResolvedValue({ id: 'post-id-1' });
    });

    it('requestUser.id === comment.authorId → isOwnedByMe: true', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([
        makeComment({ authorId: 'user-id-1' }),
      ]);

      const result = await service.getComments('post-id-1', undefined, 30, { id: 'user-id-1' });

      expect(result.items[0].isOwnedByMe).toBe(true);
    });

    it('requestUser.id !== comment.authorId → isOwnedByMe: false', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([
        makeComment({ authorId: 'user-id-1' }),
      ]);

      const result = await service.getComments('post-id-1', undefined, 30, { id: 'user-id-2' });

      expect(result.items[0].isOwnedByMe).toBe(false);
    });

    it('requestUser null → isOwnedByMe: false', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([
        makeComment({ authorId: 'user-id-1' }),
      ]);

      const result = await service.getComments('post-id-1', undefined, 30, null);

      expect(result.items[0].isOwnedByMe).toBe(false);
    });

    it('requestUser.id === reply.authorId → reply.isOwnedByMe: true', async () => {
      const reply = makeComment({
        id: 'reply-1',
        authorId: 'user-id-1',
        parentId: 'comment-1',
        author: { id: 'user-id-1', username: 'testuser', avatar: null },
      });
      mockPrismaService.comment.findMany.mockResolvedValue([
        makeComment({ replies: [reply] }),
      ]);

      const result = await service.getComments('post-id-1', undefined, 30, { id: 'user-id-1' });

      expect(result.items[0].replies[0].isOwnedByMe).toBe(true);
    });

    it('requestUser null → reply.isOwnedByMe: false', async () => {
      const reply = makeComment({
        id: 'reply-1',
        authorId: 'user-id-1',
        parentId: 'comment-1',
        author: { id: 'user-id-1', username: 'testuser', avatar: null },
      });
      mockPrismaService.comment.findMany.mockResolvedValue([
        makeComment({ replies: [reply] }),
      ]);

      const result = await service.getComments('post-id-1', undefined, 30, null);

      expect(result.items[0].replies[0].isOwnedByMe).toBe(false);
    });

    it('포스트가 없으면 POST_NOT_FOUND AppException을 던져야 한다', async () => {
      mockPrismaService.post.findFirst.mockResolvedValue(null);

      await expect(
        service.getComments('nonexistent-post', undefined, 30, null),
      ).rejects.toThrow(AppException);
      mockPrismaService.post.findFirst.mockResolvedValue(null);
      await expect(
        service.getComments('nonexistent-post', undefined, 30, null),
      ).rejects.toHaveProperty('code', ErrorCode.POST_NOT_FOUND);
    });
  });
});
