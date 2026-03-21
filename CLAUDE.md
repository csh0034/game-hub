# Game Hub

웹 기반 멀티플레이 게임 허브. 로비에서 방을 만들고 게임을 플레이한다.

## 기술 스택

- **모노레포**: Turborepo + pnpm
- **프론트엔드**: Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- **백엔드**: Node.js + Express + Socket.IO
- **데이터 저장**: Redis (ioredis)
- **상태관리**: Zustand
- **테스트**: Vitest + React Testing Library
- **린터**: ESLint 9 (flat config)
- **공유 타입**: `@game-hub/shared-types`

## 주요 명령어

```bash
pnpm install                           # 의존성 설치
docker compose up redis -d             # Redis 시작 (포트 6389)
pnpm dev                               # 프론트(3000) + 백엔드(3001) 동시 실행
pnpm build                             # 전체 빌드
pnpm lint                              # 전체 린트
pnpm --filter @game-hub/server test    # 서버 테스트
pnpm --filter @game-hub/server lint    # 서버 린트
pnpm --filter web lint                 # 웹 린트
```

## 프로젝트 구조

- `apps/web` — Next.js 프론트엔드
- `apps/server` — Express + Socket.IO 서버
- `packages/shared-types` — 공유 TypeScript 타입

상세 구조와 패턴은 `.claude/rules/architecture.md` 참고.

## 게임 규칙 문서

| 게임 | 문서 | 요약 |
|------|------|------|
| 오목 (Gomoku) | `docs/games/gomoku.md` | 2인, 15×15 보드, 5목 먼저 완성 시 승리. 금수 없음, 장목 허용 |
| 라이어 드로잉 (Liar Drawing) | `docs/games/liar-drawing.md` | 3~8인, 소셜 디덕션 그림 게임. 제시어를 모르는 라이어를 투표로 찾아내기 |
| 테트리스 (Tetris) | `docs/games/tetris.md` | 1~8인, 10×20 보드, 7-bag 랜덤, SRS 벽차기, 대전 시 쓰레기 줄 공격 |
| 지뢰찾기 (Minesweeper) | `docs/games/minesweeper.md` | 1인, 초급(9×9)/중급(16×16)/고급(16×30) 난이도. 모든 안전한 칸을 열면 승리. 첫 클릭 안전 보장 |
| 텍사스 홀덤 (Texas Hold'em) | `docs/games/texas-holdem.md` | 2~8인, 홀카드 2장 + 커뮤니티 5장으로 최고 5장 조합 승부. 시작칩 1000, SB/BB 10/20 |

## 규칙 파일 안내

| 파일 | 내용 |
|------|------|
| `.claude/rules/architecture.md` | 모노레포 구조, GameEngine 인터페이스, 프론트엔드 패턴, 게임 추가 흐름 |
| `.claude/rules/test-code.md` | 테스트 프레임워크, 네이밍, 모킹 패턴, 커버리지 우선순위 |
| `.claude/rules/commit.md` | Angular 커밋 컨벤션, scope 규칙 |
| `.claude/rules/workflow.md` | 코드 작성 후 린트 → 테스트 워크플로우 |
