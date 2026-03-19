# 아키텍처 가이드

## 모노레포 구조

Turborepo + pnpm 기반 모노레포. 3개 패키지로 구성:

```
game-hub/
├── apps/
│   ├── web/            # Next.js 15 프론트엔드 (포트 3000)
│   └── server/         # Express + Socket.IO 서버 (포트 3001)
├── packages/
│   └── shared-types/   # 공유 TypeScript 타입
├── turbo.json
└── pnpm-workspace.yaml
```

## 서버 (apps/server)

### 구조

```
src/
├── index.ts              # Express + Socket.IO 서버 진입점
├── games/
│   ├── engine-interface.ts  # GameEngine 인터페이스 정의
│   ├── game-manager.ts      # 게임 엔진 중앙 관리
│   ├── gomoku-engine.ts     # 오목 엔진
│   └── holdem-engine.ts     # 텍사스 홀덤 엔진
└── socket/
    ├── lobby-handler.ts     # 로비 소켓 이벤트 처리
    └── game-handler.ts      # 게임 소켓 이벤트 처리
```

### GameEngine 인터페이스 패턴

모든 게임은 `GameEngine` 인터페이스를 구현한다:

```typescript
interface GameEngine {
  gameType: GameType;
  minPlayers: number;
  maxPlayers: number;
  initState(players: Player[]): GameState;
  processMove(state: GameState, playerId: string, move: GameMove): GameState;
  checkWin(state: GameState): GameResult | null;
}
```

- `initState` — 플레이어 목록으로 초기 게임 상태 생성
- `processMove` — 플레이어의 이동을 적용한 새 상태 반환
- `checkWin` — 승리/무승부 판정, 진행 중이면 `null`

### GameManager

`game-manager.ts`에서 GameType → GameEngine 매핑을 관리한다. 새 게임 추가 시 여기에 엔진을 등록해야 한다.

## 프론트엔드 (apps/web)

### 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/
│   │   └── navbar.tsx
│   ├── lobby/
│   │   ├── game-card-grid.tsx
│   │   ├── room-list.tsx
│   │   ├── create-room-dialog.tsx
│   │   └── room-view.tsx
│   └── games/
│       ├── gomoku/
│       │   └── gomoku-board.tsx
│       └── texas-holdem/
│           └── holdem-table.tsx
├── hooks/
│   ├── use-socket.ts       # Socket.IO 연결 관리
│   ├── use-lobby.ts        # 로비 상태 및 이벤트
│   └── use-game.ts         # 게임 상태 및 이벤트
├── stores/
│   ├── lobby-store.ts      # Zustand 로비 스토어
│   └── game-store.ts       # Zustand 게임 스토어
└── lib/
    ├── socket.ts           # Socket.IO 클라이언트 인스턴스
    ├── game-registry.ts    # 게임 컴포넌트 lazy loading 레지스트리
    └── utils.ts
```

### 상태 관리

Zustand 스토어로 클라이언트 상태를 관리한다:

- `lobby-store` — 방 목록, 현재 방 정보, 플레이어 목록
- `game-store` — 게임 상태, 현재 턴, 결과

### 커스텀 훅

- `useSocket` — Socket.IO 연결 생명주기 관리
- `useLobby` — 로비 소켓 이벤트 바인딩 + lobby-store 연동
- `useGame` — 게임 소켓 이벤트 바인딩 + game-store 연동

### 게임 컴포넌트 lazy loading

`game-registry.ts`에서 `GameType` → React lazy component 매핑을 관리한다. 게임 컴포넌트는 필요할 때만 로드된다.

## 공유 타입 (packages/shared-types)

```
src/
├── index.ts           # 재수출
├── game-types.ts      # GameType, GameState, GameMove, GameResult
├── lobby-types.ts     # Room, RoomStatus 등
├── player-types.ts    # Player 타입
└── socket-events.ts   # 소켓 이벤트 타입 맵
```

모든 타입은 서버와 프론트엔드에서 `@game-hub/shared-types`로 import한다.

## 소켓 이벤트 네이밍

| prefix    | 용도                        |
|-----------|-----------------------------|
| `lobby:*` | 방 CRUD, 플레이어 접속      |
| `game:*`  | 게임 이동, 상태, 결과       |
| `chat:*`  | 채팅                        |
| `system:*`| 시스템 알림, 에러           |

## 게임 추가 흐름 (5단계)

1. **타입 정의** — `packages/shared-types/src/game-types.ts`에 `GameType` 추가, 해당 게임의 상태/이동 타입 정의
2. **엔진 구현** — `apps/server/src/games/`에 `GameEngine` 인터페이스 구현
3. **매니저 등록** — `apps/server/src/games/game-manager.ts`에 엔진 등록
4. **UI 컴포넌트** — `apps/web/src/components/games/<game-name>/`에 게임 UI 작성
5. **레지스트리 등록** — `apps/web/src/lib/game-registry.ts`에 lazy import 추가
