# 아키텍처 가이드

## 모노레포 구조

```
game-hub/
├── apps/
│   ├── web/            # Next.js 15 (포트 3000)
│   └── server/         # Express + Socket.IO (포트 3001)
├── packages/
│   └── shared-types/   # 공유 TypeScript 타입
├── turbo.json
└── pnpm-workspace.yaml
```

## 서버 (apps/server/src)

```
├── index.ts                 # 서버 진입점
├── games/
│   ├── engine-interface.ts  # GameEngine 인터페이스
│   ├── game-manager.ts      # GameType → GameEngine 매핑
│   ├── gomoku-engine.ts
│   ├── holdem-engine.ts
│   └── minesweeper-engine.ts
└── socket/
    ├── lobby-handler.ts     # lobby:* 이벤트
    └── game-handler.ts      # game:* 이벤트
```

모든 게임은 `GameEngine` 인터페이스를 구현하고 `game-manager.ts`에 등록한다.

## 프론트엔드 (apps/web/src)

```
├── app/                     # App Router 페이지
├── components/
│   ├── layout/navbar.tsx
│   ├── lobby/               # 로비 UI (방 목록, 생성, 입장)
│   └── games/               # 게임별 UI
│       ├── gomoku/
│       ├── texas-holdem/
│       └── minesweeper/
├── hooks/                   # useSocket, useLobby, useGame
├── stores/                  # Zustand (lobby-store, game-store)
└── lib/
    ├── socket.ts            # Socket.IO 클라이언트
    ├── game-registry.tsx    # GameType → lazy component 매핑
    └── utils.ts
```

## 공유 타입 (packages/shared-types/src)

`game-types.ts`, `lobby-types.ts`, `player-types.ts`, `socket-events.ts`를 `index.ts`에서 재수출. `@game-hub/shared-types`로 import.

## 소켓 이벤트 네이밍

`lobby:*` (방 CRUD), `game:*` (게임 진행), `chat:*` (채팅), `system:*` (시스템)

## 게임 추가 흐름

1. `shared-types/src/game-types.ts` — GameType 및 상태/이동 타입 추가
2. `server/src/games/` — GameEngine 구현
3. `server/src/games/game-manager.ts` — 엔진 등록
4. `web/src/components/games/<name>/` — 게임 UI 작성
5. `web/src/lib/game-registry.tsx` — lazy import 등록
