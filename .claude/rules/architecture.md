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
├── index.ts                 # 서버 진입점 (async bootstrap)
├── cors.ts                  # CORS origin 파싱
├── storage/
│   ├── redis-client.ts      # Redis 연결 싱글톤
│   ├── interfaces/          # 저장소 인터페이스
│   │   ├── chat-store.ts    # ChatStore
│   │   ├── room-store.ts    # RoomStore
│   │   ├── session-store.ts # SessionStore
│   │   ├── request-store.ts # RequestStore
│   │   └── index.ts         # type re-export
│   ├── redis/               # Redis 구현
│   │   ├── redis-chat-store.ts
│   │   ├── redis-room-store.ts
│   │   ├── redis-session-store.ts
│   │   ├── redis-request-store.ts
│   │   └── index.ts
│   ├── in-memory/           # 인메모리 구현 (Redis 장애 시 폴백)
│   │   ├── in-memory-chat-store.ts
│   │   ├── in-memory-room-store.ts
│   │   ├── in-memory-session-store.ts
│   │   ├── in-memory-request-store.ts
│   │   └── index.ts
│   └── index.ts             # Storage 타입 + 팩토리 (createStorage, createInMemoryStorage)
├── games/
│   ├── engine-interface.ts  # GameEngine 인터페이스
│   ├── game-manager.ts      # GameType → GameEngine 매핑 + RoomStore write-through
│   ├── gomoku-engine.ts
│   ├── gomoku-timer.ts      # 오목 턴 타이머
│   ├── holdem-engine.ts
│   ├── minesweeper-engine.ts
│   ├── tetris-engine.ts
│   ├── tetris-ticker.ts     # 테트리스 서버 틱 타이머
│   ├── liar-drawing-engine.ts
│   └── liar-drawing-timer.ts # 라이어 드로잉 페이즈 타이머
└── socket/
    ├── lobby-handler.ts     # lobby:* + chat:* 이벤트 (ChatStore 사용)
    ├── game-handler.ts      # game:* 이벤트
    ├── nickname-handler.ts  # player:* 이벤트 (SessionStore 사용, 재접속 지원)
    ├── request-handler.ts   # request:* 이벤트 (요청사항 CRUD, 관리자 수락/거부/완료 처리)
    └── broadcast-player-count.ts  # 접속자 수 브로드캐스트
```

모든 게임은 `GameEngine` 인터페이스를 구현하고 `game-manager.ts`에 등록한다.

### Redis 영속화

채팅 이력, 방 목록, 플레이어 세션, 요청사항을 Redis에 저장한다. 인메모리 Map이 source of truth이고 Redis는 write-through 백업이다. Redis 장애 시 4개 store 모두 인메모리 구현으로 전환하여 전체 기능이 정상 동작한다 (graceful degradation). `Storage` 인터페이스를 통해 `createStorage(redis)`와 `createInMemoryStorage()`가 동일한 타입을 반환한다.

- **채팅**: `chat:lobby` (LIST), `chat:room:{roomId}` (LIST) — 각 최근 50개
- **방**: `room:{roomId}` (STRING/JSON), `rooms` (SET) — 서버 시작 시 복구
- **세션**: `session:{socketId}` (STRING/JSON, TTL 24h), `nickname:{nickname}` (STRING) — 재접속 지원
- **요청사항**: `request:{id}` (STRING/JSON), `requests` (SET) — 기능 요청 게시판, 4단계 상태 (open/in-progress/rejected/resolved)

## 프론트엔드 (apps/web/src)

```
├── app/                     # App Router 페이지
├── components/
│   ├── layout/navbar.tsx
│   ├── lobby/               # 로비 UI (방 목록, 생성, 입장)
│   ├── chat/chat-panel.tsx  # 채팅 UI (로비/방 공용)
│   ├── request-board/       # 요청사항 게시판 UI (목록, 작성, 수락/거부/완료 처리)
│   └── games/               # 게임별 UI
│       ├── gomoku/
│       ├── texas-holdem/
│       ├── minesweeper/
│       ├── tetris/
│       └── liar-drawing/
├── hooks/                   # useSocket, useLobby, useGame, useChat, useRequests
├── stores/                  # Zustand (lobby-store, game-store, chat-store, request-store)
└── lib/
    ├── socket.ts            # Socket.IO 클라이언트
    ├── game-registry.tsx    # GameType → lazy component 매핑
    └── utils.ts
```

## 공유 타입 (packages/shared-types/src)

`game-types.ts`, `lobby-types.ts`, `player-types.ts`, `request-types.ts`, `socket-events.ts`를 `index.ts`에서 재수출. `@game-hub/shared-types`로 import.

## 소켓 이벤트 네이밍

`lobby:*` (방 CRUD), `game:*` (게임 진행), `player:*` (닉네임/인증), `chat:*` (로비 채팅, 방 채팅, 이력 요청), `request:*` (요청사항 CRUD), `system:*` (시스템)

서버는 로비/방별 최근 50개 채팅 메시지를 Redis에 보관한다. 클라이언트는 로비/방 입장 시 `chat:request-history` 이벤트로 이력을 요청한다.

## 게임 추가 흐름

1. `shared-types/src/game-types.ts` — GameType 및 상태/이동 타입 추가
2. `server/src/games/` — GameEngine 구현
3. `server/src/games/game-manager.ts` — 엔진 등록
4. `web/src/components/games/<name>/` — 게임 UI 작성
5. `web/src/lib/game-registry.tsx` — lazy import 등록
