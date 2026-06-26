import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

const TENANT_ID = 'pono';
const DEFAULT_LIMIT = 30;

interface CursorParsed {
  date: Date;
  id: string;
}

function parseCursor(cursor: string): CursorParsed {
  const idx = cursor.indexOf('_');
  return {
    date: new Date(cursor.slice(0, idx)),
    id: cursor.slice(idx + 1),
  };
}

function buildCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}_${id}`;
}

const authorSelect = {
  id: true,
  username: true,
  avatar: true,
} as const;

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /comments/:postId ─────────────────────────────────────────
  async getComments(
    postId: string,
    cursor?: string,
    limit: number = DEFAULT_LIMIT,
    requestUser: { id: string } | null = null,
  ) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, tenantId: TENANT_ID },
    });
    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    const take = Math.min(limit, DEFAULT_LIMIT);

    // 루트 댓글만 cursor 페이지네이션 (createdAt ASC)
    const where: any = {
      postId,
      tenantId: TENANT_ID,
      parentId: null,
    };

    if (cursor) {
      const { date, id } = parseCursor(cursor);
      where.OR = [
        { createdAt: { gt: date } },
        { createdAt: date, id: { gt: id } },
      ];
    }

    const rootComments = await this.prisma.comment.findMany({
      where,
      include: {
        author: { select: authorSelect },
        replies: {
          where: { tenantId: TENANT_ID },
          include: { author: { select: authorSelect } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    const hasMore = rootComments.length > take;
    const items = hasMore ? rootComments.slice(0, take) : rootComments;

    const nextCursor =
      hasMore && items.length > 0
        ? buildCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
        : null;

    const mapped = items.map((c) => ({
      id: c.id,
      author: c.author,
      body: c.body,
      parentId: c.parentId,
      isOwnedByMe: requestUser !== null && requestUser.id === c.authorId,
      replies: c.replies.map((r) => ({
        id: r.id,
        author: r.author,
        body: r.body,
        parentId: r.parentId as string,
        isOwnedByMe: requestUser !== null && requestUser.id === r.authorId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return { items: mapped, nextCursor, hasMore };
  }

  // ── POST /comments/:postId ────────────────────────────────────────
  async createComment(
    postId: string,
    dto: CreateCommentDto,
    userId: string,
  ) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, tenantId: TENANT_ID },
    });
    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, postId, tenantId: TENANT_ID },
      });
      if (!parent) {
        throw new NotFoundException('부모 댓글을 찾을 수 없습니다.');
      }
      if (parent.parentId !== null) {
        throw new BadRequestException('대댓글에는 댓글을 달 수 없습니다.');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        body: dto.body,
        parentId: dto.parentId ?? null,
        tenantId: TENANT_ID,
      },
      include: {
        author: { select: authorSelect },
      },
    });

    return {
      id: comment.id,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
      replies: [],
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  // ── DELETE /comments/:postId/:commentId ───────────────────────────
  async deleteComment(
    postId: string,
    commentId: string,
    userId: string,
  ): Promise<{ id: string }> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, postId, tenantId: TENANT_ID },
    });
    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });

    return { id: commentId };
  }
}
