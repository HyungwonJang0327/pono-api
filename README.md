# Pono API

스냅(사진)과 아티클(장문 글)을 함께 올리는 SNS **Pono**의 백엔드 API 서버입니다.

- 프론트엔드 리포: https://github.com/HyungwonJang0327/pono-web
- 서비스(프론트 배포): https://dev-pono.vercel.app/

<!-- TODO: screenshot — API 전체 엔드포인트 목록 (Swagger 또는 표 캡처) -->
<!-- TODO: screenshot — Prisma 스키마 기반 ERD (User/Post/Follow/Like/Comment 관계도) -->
<!-- TODO: screenshot — Clerk Webhook → DB 동기화 시퀀스 다이어그램 -->
<!-- TODO: screenshot — S3 Presigned URL 업로드 플로우 다이어그램 -->

## ✨ 핵심 기능

- **두 가지 포스트 타입**: 스냅(이미지 + 캡션) / 아티클(제목·리치 텍스트 본문·커버 이미지·읽기 시간), 아티클 임시저장(draft) 지원
- **피드**: 추천 탭(전체 공개 글) / 팔로잉 탭(팔로우한 유저 글), 커서 기반 무한 스크롤
- **소셜 기능**: 팔로우/언팔로우, 팔로워·팔로잉 목록, 좋아요, 댓글 + 1단계 대댓글
- **유저 프로필**: username 기반 공개 프로필, 프로필 수정, 유저별 포스트 목록
- **이미지 업로드**: S3 Presigned URL 발급으로 클라이언트가 서버를 거치지 않고 직접 업로드
- **인증**: Clerk JWT 검증(전역 Guard) + Webhook으로 유저 데이터 DB 동기화
- **선택적 인증**: 비로그인도 피드·프로필 열람 가능, 로그인 시 같은 API가 `likedByMe` 등 개인화 정보 포함

## 🛠 기술 스택

| 분류 | 스택 |
|---|---|
| 프레임워크 | NestJS 11, TypeScript 5.7 |
| DB / ORM | PostgreSQL, Prisma 6.19 |
| 인증 | Clerk (`@clerk/backend` 3.7) + Svix 웹훅 서명 검증 |
| 스토리지 | AWS S3 (AWS SDK v3, `s3-request-presigner`) |
| 검증 | class-validator / class-transformer |
| 테스트 | Jest 30, Supertest |
| 배포 | Docker (multi-stage) + Railway |

## 🏗 아키텍처 / 폴더 구조

도메인별 모듈 7개(auth, user, post, feed, follow, like, comment)로 분리한 표준 NestJS 구조입니다.

```
src/
├── auth/        # Clerk Webhook 수신 → 유저 생성/삭제 DB 동기화
├── user/        # 내 프로필 조회·수정, username 공개 프로필, 유저별 포스트 목록
├── post/        # 포스트 CRUD, S3 Presigned URL 발급 (s3.service.ts)
├── feed/        # 추천/팔로잉 피드, 커서 페이지네이션
├── follow/      # 팔로우/언팔로우, 팔로워·팔로잉 목록
├── like/        # 좋아요 추가/취소
├── comment/     # 댓글·대댓글 (1-depth 제한), 커서 페이지네이션
├── common/      # 전역 Guard·에러 코드 카탈로그·예외 필터·데코레이터·유틸
├── prisma/      # PrismaService (DB 커넥션)
└── main.ts      # 전역 ValidationPipe·예외 필터·CORS 설정
```

## 🔍 기술적으로 신경 쓴 점

### 1. Clerk 인증 — 전역 Guard + Webhook 이중 동기화
- `ClerkAuthGuard`를 `APP_GUARD`로 등록해 모든 라우트가 기본 보호되고, `@Public()` 데코레이터로만 예외를 엽니다. Public 라우트에서도 토큰이 있으면 `req.user`를 세팅하는 **선택적 인증**으로, 같은 피드 API가 로그인 여부에 따라 개인화 데이터를 다르게 반환합니다.
- 유저 생성은 Clerk Webhook(`user.created`, Svix 서명 검증)으로 동기화하되, **웹훅 도착 전에 API를 호출하는 타이밍 갭**을 Guard의 `upsert`로 방어해 JWT가 유효하면 DB row 부재로 실패하는 일이 없도록 했습니다.

### 2. S3 Presigned URL 직접 업로드
- 이미지가 서버를 경유하면 트래픽·메모리 부담이 커지므로, 서버는 10분 만료 Presigned PUT URL만 발급하고 클라이언트가 S3에 직접 업로드합니다. 키는 `{prefix}/{uuid}-{filename}`으로 충돌을 방지하고, 환경별 prefix(`dev` 등)로 버킷을 분리 없이 구분합니다. 포스트 삭제 시 S3 객체도 함께 정리합니다.

### 3. 커서 기반 페이지네이션
- 피드·댓글·유저 포스트 목록 모두 offset 대신 `{createdAt ISO}_{id}` 복합 커서를 사용합니다. `createdAt`이 같은 행은 `id`로 타이브레이크해 **글이 추가/삭제돼도 중복·누락 없이** 안정적으로 이어지고, `take: limit + 1` 패턴으로 추가 쿼리 없이 `hasMore`를 판정합니다. 정렬 컬럼에는 복합 인덱스(`[tenantId, createdAt desc]` 등)를 걸었습니다.

### 4. 에러 코드 카탈로그 중앙화
- 모든 에러를 `ErrorCode` enum(+ status/message 정의) 한 파일에 모으고 `AppException.of(code)`로만 던집니다. 프론트는 이 코드를 그대로 i18n 키로 사용해 다국어 에러 메시지를 처리하고, 서버 메시지에 한국어가 섞이는 것을 구조적으로 차단했습니다. `ValidationPipe`의 `exceptionFactory`도 같은 포맷으로 통일했습니다.

### 5. 입력 검증과 멀티테넌트 대비 스키마
- 전역 `ValidationPipe`에 `whitelist` + `forbidNonWhitelisted`를 적용해 DTO에 정의되지 않은 필드는 요청 자체를 거부합니다. 모든 테이블에 `tenantId`를 두어 단일 DB로 서비스 확장이 가능하도록 설계했습니다.

## 🚀 로컬 실행

```bash
npm install
npx prisma migrate dev   # DB 마이그레이션
npm run start:dev        # http://localhost:3005
```

`.env.example`을 복사해 `.env`를 만들고 아래 환경변수를 채웁니다.

```
DATABASE_URL
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME
S3_PREFIX
PORT
NODE_ENV
```

## 🧪 테스트

도메인 서비스 6개 + 공통 모듈(예외 필터, 검증 팩토리 등)에 대한 유닛 테스트가 있습니다.

```bash
npm test          # 유닛 테스트
npm run test:cov  # 커버리지
```

---

Claude Code를 활용한 1인 개발 프로젝트입니다 — 아키텍처, 데이터 모델, 기술 선택은 직접 결정했습니다.
