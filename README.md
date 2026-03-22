# Game Hub

웹 기반 실시간 멀티플레이 게임 허브. 로비에서 방을 만들고, 다양한 게임을 함께 플레이할 수 있습니다.

## 지원 게임

| 게임 | 인원 | 설명 |
|------|------|------|
| 🎨 라이어 드로잉 | 3~8명 | 소셜 디덕션 그림 게임, 제시어를 모르는 라이어를 투표로 찾아내기 |
| 🖼️ 캐치마인드 | 3~8명 | 출제자가 그린 그림을 보고 채팅으로 정답을 맞추는 드로잉 퀴즈 게임 |
| 🧱 테트리스 | 1~8명 | 7-bag 랜덤, SRS 벽차기, 대전 시 쓰레기 줄 공격 |
| ⚫ 오목 | 2명 | 15×15 보드에서 5목을 먼저 완성하면 승리 |
| 💣 지뢰찾기 | 1명 | 초급/중급/고급 난이도, 모든 안전한 칸을 열면 승리 |
| 🃏 텍사스 홀덤 | 2~8명 | 홀카드 2장 + 커뮤니티 5장으로 최고의 5장 조합 승부 (패치중) |

## 기술 스택

| 영역 | 기술 |
|------|------|
| 모노레포 | Turborepo + pnpm |
| 프론트엔드 | Next.js 15 (App Router) + React 19 + Tailwind CSS 4 |
| 백엔드 | Node.js + Express + Socket.IO |
| 상태관리 | Zustand |
| 공유 타입 | `@game-hub/shared-types` (TypeScript) |
| 테스트 | Vitest + React Testing Library |
| 데이터 저장 | Redis (ioredis) |
| 배포 | Docker (multi-stage) + GitHub Actions |

## 프로젝트 구조

```
game-hub/
├── apps/
│   ├── web/              # Next.js 프론트엔드 (포트 3000)
│   └── server/           # Express + Socket.IO 서버 (포트 3001)
├── packages/
│   └── shared-types/     # 공유 TypeScript 타입
├── docs/
│   └── games/            # 게임별 규칙 문서
└── .github/workflows/    # CI/CD (Docker 빌드 & 푸시)
```

## 시작하기

### 사전 요구사항

- Node.js 20+
- pnpm 9.15.0+
- Docker (Redis 실행용)

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# Redis 시작 (포트 6389)
docker compose up redis -d

# 개발 서버 실행 (프론트 3000 + 백엔드 3001)
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속합니다.

> Redis 없이도 서버가 동작하지만, 서버 재시작 시 채팅 이력/방/세션이 소실됩니다.

### 빌드

```bash
pnpm build
```

### 테스트 및 린트

```bash
pnpm lint                              # 전체 린트
pnpm --filter @game-hub/server test    # 서버 테스트
```

## Docker 배포

```bash
# 이미지 빌드
docker build -t game-hub .

# 컨테이너 실행 (Redis 주소 지정)
docker run -p 3000:3000 -p 3001:3001 \
  -e REDIS_URL=redis://host.docker.internal:6389 \
  game-hub
```

### 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `REDIS_URL` | Redis 연결 주소 | `redis://localhost:6389` |
| `CORS_ORIGIN` | 허용 도메인 | `http://localhost:3000` |
| `PORT` | 서버 포트 | `3001` |
| `ADMIN_NICKNAMES` | 관리자 닉네임 (쉼표 구분) | `admin` |
| `GITHUB_REPO_URL` | GitHub 레포 URL (커밋 링크용) | `https://github.com/csh0034/game-hub` |

- 헬스체크: `GET http://localhost:3001/health`

## 주요 특징

- **실시간 통신** — Socket.IO 기반 양방향 통신, 자동 재연결 지원
- **Redis 영속화** — 채팅 이력, 방 목록, 플레이어 세션을 Redis에 저장하여 서버 재시작 후에도 복구
- **재접속 지원** — 같은 닉네임으로 재접속 시 이전 방에 자동 복귀
- **타입 안전** — 프론트/백엔드 간 공유 TypeScript 타입
- **확장 가능한 게임 엔진** — `GameEngine` 인터페이스 기반으로 새 게임 추가 용이
- **게임 컴포넌트 지연 로딩** — 선택한 게임만 로드
- **요청사항 게시판** — 기능 요청 등록, 관리자 완료 처리(커밋 링크 자동 생성) 및 삭제
- **프로덕션 보안** — Docker non-root 사용자, HEALTHCHECK 설정

## 게임 추가 방법

1. `packages/shared-types/src/game-types.ts` — GameType 및 상태/이동 타입 정의
2. `apps/server/src/games/<name>-engine.ts` — GameEngine 인터페이스 구현
3. `apps/server/src/games/game-manager.ts` — 엔진 등록
4. `apps/web/src/components/games/<name>/` — 게임 UI 작성
5. `apps/web/src/lib/game-registry.tsx` — lazy import 등록

자세한 내용은 [게임별 규칙 문서](docs/games/)를 참고하세요.
