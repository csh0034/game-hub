# Game Hub

웹 기반 멀티플레이 게임 허브. 로비에서 방을 만들고 게임을 플레이한다.

## 기술 스택

- **언어**: TypeScript
- **모노레포**: Turborepo + pnpm
- **프론트엔드**: Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- **백엔드**: Node.js + Express + Socket.IO
- **데이터 저장**: Redis (ioredis)
- **상태관리**: Zustand
- **테스트**: Vitest + React Testing Library
- **린터**: ESLint 9 (flat config)
- **커버리지**: Vitest Coverage (v8)
- **배포**: Docker (멀티스테이지 빌드)

## 주요 명령어

```bash
pnpm install                              # 의존성 설치
docker compose up redis -d                # Redis 시작 (포트 6389)
pnpm dev                                  # 프론트(3000) + 백엔드(3001) 동시 실행
pnpm build                                # 전체 빌드
pnpm lint                                 # 전체 린트
pnpm --filter shared-types lint           # 공유 타입 린트
pnpm --filter server lint                 # 서버 린트
pnpm --filter server test:coverage        # 서버 테스트 + 커버리지
pnpm --filter web lint                    # 웹 린트
pnpm --filter web test:coverage           # 웹 테스트 + 커버리지
```

## 게임 규칙 문서

| 게임 | 문서 |
|------|------|
| 라이어 드로잉 (Liar Drawing) | `docs/games/liar-drawing.md` |
| 캐치마인드 (Catch Mind) | `docs/games/catch-mind.md` |
| 테트리스 (Tetris) | `docs/games/tetris.md` |
| 오목 (Gomoku) | `docs/games/gomoku.md` |
| 지뢰찾기 (Minesweeper) | `docs/games/minesweeper.md` |
| 텍사스 홀덤 (Texas Hold'em) | `docs/games/texas-holdem.md` |

## 공통 기능 문서

| 기능 | 문서 |
|------|------|
| 채팅 | `docs/chat.md` |
| 관전 | `docs/spectator.md` |
| 강퇴 | `docs/kick.md` |
| 랭킹 | `docs/ranking.md` |
| 요청사항 게시판 | `docs/request-board.md` |
| 관리자 공지 | `docs/announcement.md` |
| 방 운영 | `docs/room.md` |

## 기타 문서

| 문서 | 위치 |
|------|------|
| 용어사전 | `docs/glossary.md` |

## 규칙 문서

| 규칙 | 문서 |
|------|------|
| 아키텍처 | `.claude/rules/architecture.md` |
| 테스트 코드 | `.claude/rules/test-code.md` |
| 커밋 컨벤션 | `.claude/rules/commit.md` |
| 워크플로우 | `.claude/rules/workflow.md` |
| 문서 작성 | `.claude/rules/docs.md` |
