/**
 * PostService — 아티클 작성 핵심 로직 단위 테스트
 *
 * DB 호출(PrismaService)은 mock으로 대체하고
 * coverImage 자동 추출 / readingTime 자동 계산 / isDraft 기본값 로직을 검증한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { ConfigService } from '@nestjs/config';

// ── helper: TipTap 텍스트 노드 ───────────────────────────────────
function textNode(text: string) {
  return { type: 'text', text };
}

function paragraph(...children: object[]) {
  return { type: 'paragraph', content: children };
}

function imageNode(src: string) {
  return { type: 'image', attrs: { src } };
}

function doc(...content: object[]) {
  return { type: 'doc', content };
}

// ── 공통 mock 반환값 생성 ─────────────────────────────────────────
function mockPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-id-1',
    type: 'article',
    title: '테스트 아티클',
    body: null,
    caption: null,
    images: null,
    coverImage: null,
    readingTime: 1,
    isDraft: false,
    authorId: 'user-id-1',
    tenantId: 'pono',
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
    author: {
      id: 'user-id-1',
      username: 'testuser',
      avatar: null,
      bio: null,
      clerkId: 'clerk-1',
      tenantId: 'pono',
      createdAt: new Date(),
    },
    _count: { likes: 0, comments: 0 },
    likes: [],
    ...overrides,
  };
}

describe('PostService', () => {
  let service: PostService;

  const prismaMock = {
    post: {
      create: jest.fn(),
    },
  };

  const s3Mock = {
    createPresignedUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: S3Service, useValue: s3Mock },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // presigned URL
  // ─────────────────────────────────────────────────────────────────
  describe('createPresignedUrl', () => {
    it('S3Service.createPresignedUrl 결과를 그대로 반환해야 한다', async () => {
      const result = { uploadUrl: 'https://s3.example.com/upload', fileUrl: 'https://s3.example.com/file' };
      s3Mock.createPresignedUrl.mockResolvedValue(result);

      const response = await service.createPresignedUrl('photo.jpg', 'image/jpeg');
      expect(response).toEqual(result);
      expect(s3Mock.createPresignedUrl).toHaveBeenCalledWith('photo.jpg', 'image/jpeg');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 스냅 작성
  // ─────────────────────────────────────────────────────────────────
  describe('createPost — snap', () => {
    it('이미지 없이 스냅 생성 시 BadRequestException을 던져야 한다', async () => {
      await expect(
        service.createPost({ type: 'snap', images: [] }, 'user-id-1'),
      ).rejects.toThrow('스냅은 이미지가 최소 1장 필요합니다.');
    });

    it('이미지 1장으로 스냅을 정상 생성해야 한다', async () => {
      const images = [{ url: 'https://s3.example.com/img1.jpg', width: 1080, height: 1350 }];
      prismaMock.post.create.mockResolvedValue(
        mockPost({ type: 'snap', images, caption: null, title: null }),
      );

      const result = await service.createPost({ type: 'snap', images }, 'user-id-1');

      expect(result.type).toBe('snap');
      if (result.type === 'snap') {
        expect(result.images).toEqual(images);
        expect(result.caption).toBeNull();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 아티클 작성
  // ─────────────────────────────────────────────────────────────────
  describe('createPost — article', () => {
    it('제목 없이 아티클 생성 시 BadRequestException을 던져야 한다', async () => {
      await expect(
        service.createPost({ type: 'article' }, 'user-id-1'),
      ).rejects.toThrow('아티클은 제목이 필요합니다.');
    });

    it('isDraft 미전달 시 false로 저장해야 한다', async () => {
      prismaMock.post.create.mockResolvedValue(mockPost({ isDraft: false }));

      await service.createPost({ type: 'article', title: '제목' }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.isDraft).toBe(false);
    });

    it('isDraft: true 전달 시 임시저장으로 처리해야 한다', async () => {
      prismaMock.post.create.mockResolvedValue(mockPost({ isDraft: true }));

      await service.createPost({ type: 'article', title: '제목', isDraft: true }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.isDraft).toBe(true);
    });

    it('coverImage 미전달 시 body에서 첫 이미지 URL을 자동 추출해야 한다', async () => {
      const imgUrl = 'https://s3.example.com/cover.jpg';
      const body = doc(
        paragraph(textNode('소개글')),
        imageNode(imgUrl),
        paragraph(textNode('본문 내용')),
      );

      prismaMock.post.create.mockResolvedValue(mockPost({ coverImage: imgUrl, body }));

      await service.createPost({ type: 'article', title: '제목', body }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.coverImage).toBe(imgUrl);
    });

    it('coverImage 전달 시 body 이미지보다 우선해야 한다', async () => {
      const explicit = 'https://s3.example.com/explicit.jpg';
      const body = doc(imageNode('https://s3.example.com/body-img.jpg'));

      prismaMock.post.create.mockResolvedValue(mockPost({ coverImage: explicit }));

      await service.createPost(
        { type: 'article', title: '제목', body, coverImage: explicit },
        'user-id-1',
      );

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.coverImage).toBe(explicit);
    });

    it('body 없을 때 coverImage가 null이어야 한다', async () => {
      prismaMock.post.create.mockResolvedValue(mockPost({ coverImage: null }));

      await service.createPost({ type: 'article', title: '제목' }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.coverImage).toBeNull();
    });

    it('body 글자수 기준 readingTime을 자동 계산해야 한다 (500자 = 1분)', async () => {
      const text500 = 'a'.repeat(500);
      const body = doc(paragraph(textNode(text500)));

      prismaMock.post.create.mockResolvedValue(mockPost({ readingTime: 1 }));
      await service.createPost({ type: 'article', title: '제목', body }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.readingTime).toBe(1);
    });

    it('1000자 본문은 readingTime이 2분이어야 한다', async () => {
      const text1000 = 'a'.repeat(1000);
      const body = doc(paragraph(textNode(text1000)));

      prismaMock.post.create.mockResolvedValue(mockPost({ readingTime: 2 }));
      await service.createPost({ type: 'article', title: '제목', body }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.readingTime).toBe(2);
    });

    it('body 없을 때 readingTime은 최소값 1이어야 한다', async () => {
      prismaMock.post.create.mockResolvedValue(mockPost({ readingTime: 1 }));
      await service.createPost({ type: 'article', title: '제목' }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.readingTime).toBe(1);
    });

    it('1자 본문도 readingTime 최소값 1이어야 한다', async () => {
      const body = doc(paragraph(textNode('안')));

      prismaMock.post.create.mockResolvedValue(mockPost({ readingTime: 1 }));
      await service.createPost({ type: 'article', title: '제목', body }, 'user-id-1');

      const callArg = prismaMock.post.create.mock.calls[0][0];
      expect(callArg.data.readingTime).toBe(1);
    });
  });
});
