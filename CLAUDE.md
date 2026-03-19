# Game Hub

웹 기반 멀티플레이 게임 허브. 로비에서 방을 만들고 게임을 플레이한다.

## 기술 스택
- **모노레포**: Turborepo + pnpm
- **프론트엔드**: Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- **백엔드**: Node.js + Express + Socket.IO
- **상태관리**: Zustand
- **공유 타입**: `@game-hub/shared-types`

## 실행
```bash
pnpm install
pnpm dev        # 프론트(3000) + 백엔드(3001) 동시 실행
```

## 프로젝트 구조
- `apps/web` - Next.js 프론트엔드
- `apps/server` - Express + Socket.IO 서버
- `packages/shared-types` - 공유 TypeScript 타입

## 게임 추가 방법
1. `packages/shared-types/src/game-types.ts` - GameType에 추가, 상태/이동 타입 정의
2. `apps/server/src/games/` - GameEngine 인터페이스 구현
3. `apps/server/src/games/game-manager.ts` - 엔진 등록
4. `apps/web/src/components/games/` - 게임 UI 컴포넌트
5. `apps/web/src/lib/game-registry.ts` - lazy import 등록

## 소켓 이벤트 네이밍
- `lobby:*` - 방 CRUD, 플레이어 접속
- `game:*` - 게임 이동, 상태, 결과
- `chat:*` - 채팅
