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
├── admin.ts                 # 관리자 닉네임 설정
├── storage/
│   ├── redis-client.ts      # Redis 연결 싱글톤
│   ├── interfaces/          # 저장소 인터페이스
│   │   ├── chat-store.ts    # ChatStore
│   │   ├── room-store.ts    # RoomStore
│   │   ├── session-store.ts # SessionStore
│   │   ├── request-store.ts # RequestStore
│   │   ├── ranking-store.ts # RankingStore
│   │   ├── placard-store.ts # PlacardStore
│   │   └── index.ts         # type re-export
│   ├── redis/               # Redis 구현
│   │   ├── redis-chat-store.ts
│   │   ├── redis-room-store.ts
│   │   ├── redis-session-store.ts
│   │   ├── redis-request-store.ts
│   │   ├── redis-ranking-store.ts
│   │   ├── redis-placard-store.ts
│   │   └── index.ts
│   ├── in-memory/           # 인메모리 구현 (Redis 장애 시 폴백)
│   │   ├── in-memory-chat-store.ts
│   │   ├── in-memory-room-store.ts
│   │   ├── in-memory-session-store.ts
│   │   ├── in-memory-request-store.ts
│   │   ├── in-memory-ranking-store.ts
│   │   ├── in-memory-placard-store.ts
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
│   ├── liar-drawing-timer.ts # 라이어 드로잉 페이즈 타이머
│   ├── catch-mind-engine.ts
│   └── catch-mind-timer.ts   # 캐치마인드 그리기 타이머
└── socket/
    ├── lobby-handler.ts     # lobby:* 이벤트 (방 CRUD, 방 이름 수정, 관전, 강퇴)
    ├── chat-handler.ts      # chat:* 이벤트 (ChatStore 사용)
    ├── game-handler.ts      # game:* + ranking:* 이벤트 (RankingStore 사용)
    ├── nickname-handler.ts  # player:* 이벤트 (SessionStore 사용, 재접속 지원)
    ├── request-handler.ts   # request:* 이벤트 (요청사항 CRUD, 관리자 수락/거부/완료 처리)
    ├── placard-handler.ts   # placard:* 이벤트 (PlacardStore 사용, 관리자 배너 설정)
    └── broadcast-player-count.ts  # 접속자 수 브로드캐스트
```

모든 게임은 `GameEngine` 인터페이스를 구현하고 `game-manager.ts`에 등록한다.

### Redis 영속화

채팅 이력, 방 목록, 플레이어 세션, 요청사항, 랭킹, 플랜카드를 Redis에 저장한다. 방 목록은 GameManager의 인메모리 Map이 source of truth이고 Redis는 write-through 백업이다. 채팅, 세션, 요청사항, 랭킹, 플랜카드는 Redis가 primary store이다. Redis 장애 시 6개 store 모두 인메모리 구현으로 전환하여 전체 기능이 정상 동작한다 (graceful degradation). `Storage` 인터페이스를 통해 `createStorage(redis)`와 `createInMemoryStorage()`가 동일한 타입을 반환한다.

- **채팅**: `chat:lobby` (LIST), `chat:room:{roomId}` (LIST) — 각 최근 50개
- **방**: `room:{roomId}` (STRING/JSON), `rooms` (SET) — 서버 시작 시 복구
- **세션**: `session:{socketId}` (STRING/JSON, TTL 24h), `nickname:{nickname}` (STRING) — 재접속 지원
- **요청사항**: `request:{id}` (STRING/JSON), `requests` (SET) — 기능 요청 게시판, 라벨 4종 (feature/bug/improvement/new-game), 4단계 상태 (open/in-progress/rejected/resolved)
- **랭킹**: `ranking:{gameType}:{difficulty}` (STRING/JSON) — 난이도별 Top 10, 지뢰찾기(완료시간) + 테트리스 솔로(점수)
- **플랜카드**: `placard:text` (STRING) — 로비 상단 배너 문구, 관리자가 설정

## 프론트엔드 (apps/web/src)

```
├── app/                     # App Router 페이지
│   ├── page.tsx             # / → /lobby 리다이렉트
│   ├── lobby/page.tsx       # /lobby — 로비 (GameHub activeTab="lobby")
│   ├── request/page.tsx     # /request — 요청사항 (GameHub activeTab="requests")
│   └── room/[id]/page.tsx   # /room/[id] — 방 직접 입장 (pendingRoomId 설정 후 GameHub 렌더)
├── components/
│   ├── game-hub.tsx         # 메인 앱 로직 (닉네임, 로비, 방, URL 동기화)
│   ├── common/confirm-dialog.tsx       # 공통 확인 다이얼로그
│   ├── common/placard-dialog.tsx      # 플랜카드 설정 다이얼로그
│   ├── layout/navbar.tsx
│   ├── lobby/               # 로비 UI (방 목록, 생성, 입장)
│   ├── chat/chat-panel.tsx  # 채팅 UI (로비/방 공용)
│   ├── ranking/
│   │   ├── ranking-card.tsx         # 랭킹 카드 UI (난이도별 Top 10)
│   │   └── lobby-ranking-panel.tsx  # 로비 랭킹 패널 (게임/난이도 탭 + RankingCard)
│   ├── request-board/       # 요청사항 게시판 UI (목록, 작성, 수락/거부/완료 처리)
│   └── games/               # 게임별 UI
│       ├── gomoku/
│       ├── texas-holdem/
│       ├── minesweeper/
│       ├── tetris/
│       ├── liar-drawing/
│       └── catch-mind/
├── hooks/                   # useSocket, useLobby, useGame, useChat, useRequests, useRanking
├── stores/                  # Zustand (lobby-store, game-store, chat-store, request-store, ranking-store)
└── lib/
    ├── socket.ts            # Socket.IO 클라이언트
    ├── game-registry.tsx    # GameType → lazy component 매핑
    ├── hand-evaluator.ts    # 텍사스 홀덤 핸드 평가
    └── utils.ts
```

### 날짜/시간 표시 형식

UI에서 날짜·시간을 표시할 때는 `lib/utils.ts`의 `formatDateTime`을 사용한다. 형식: `YYYY-MM-DD HH:mm:ss` (예: `2026-03-24 15:42:09`). 직접 `toLocaleString` 등을 호출하지 않는다.

### 라우팅

- `/` → `/lobby` 리다이렉트. 모든 라우트는 `<GameHub />` 컴포넌트를 렌더하며, `activeTab` prop으로 탭을 결정한다.
- `/lobby` — 로비 (게임 카드, 방 목록, 채팅). `/request` — 요청사항 게시판. 탭 전환은 Next.js `<Link>`로 라우팅.
- `/room/[id]` — 방 직접 입장. `pendingRoomId`를 lobby-store에 설정 → `player:set-nickname` 인증 완료 후 자동 `joinRoom` 실행. 플레이어 참가 실패 시 관전 자동 전환 시도, 관전도 불가하면 로비로 이동.
- 방 생성/입장 시 `history.pushState`로 URL을 `/room/{roomId}`로 변경, 나갈 때 `/lobby`로 복원.
- 대기실에서 "링크 복사" 버튼으로 `{origin}/room/{roomId}` URL을 클립보드에 복사.

## 공유 타입 (packages/shared-types/src)

`game-types.ts`, `lobby-types.ts`, `player-types.ts`, `request-types.ts`, `ranking-types.ts`, `socket-events.ts`를 `index.ts`에서 재수출. `@game-hub/shared-types`로 import.

## 소켓 이벤트 네이밍

`lobby:*` (방 CRUD, 방 이름 수정, 관전 입장/퇴장/강퇴), `game:*` (게임 진행), `player:*` (닉네임/인증), `chat:*` (로비 채팅, 방 채팅, 이력 요청, 귓속말), `request:*` (요청사항 CRUD), `ranking:*` (랭킹 조회/갱신), `placard:*` (플랜카드 조회/설정), `system:*` (시스템)

서버는 로비/방별 최근 50개 채팅 메시지를 Redis에 보관한다. 클라이언트는 로비/방 입장 시 `chat:request-history` 이벤트로 이력을 요청한다.

### 클라이언트 소켓 emit 디바운싱

슬라이더(`type="range"`) 등 연속 입력이 발생하는 UI에서 소켓 emit을 할 때는 **300ms 디바운싱**을 적용한다. `useLobby` 훅의 `updateGameOptions`가 대표적 예시이며, 새로운 연속 입력 기반 emit을 추가할 때도 동일한 패턴(`useRef` + `clearTimeout` + `setTimeout`)을 따른다.

## 배포

Docker 멀티스테이지 빌드로 프로덕션 이미지를 생성한다. `Dockerfile`에서 의존성 설치 → 빌드 → 프로덕션 이미지 3단계로 구성되며, Next.js standalone 출력과 Express 서버를 concurrently로 동시 실행한다. non-root 사용자(gamehub)로 실행하고, 헬스체크는 서버의 `/health` 엔드포인트를 사용한다.

### 운영 환경 제약

운영 환경은 **HTTP**(비 HTTPS)로 서비스한다. 클라이언트 코드에서 secure context 전용 Web API를 사용하지 않는다.

- `crypto.randomUUID()` → 폴백 필요
- `navigator.clipboard.writeText()` → 폴백 필요
- `Notification API`, `Web Push` 등 → 사용 불가

## 게임 추가 흐름

1. `shared-types/src/game-types.ts` — GameType 및 상태/이동 타입 추가
2. `server/src/games/` — GameEngine 구현
3. `server/src/games/game-manager.ts` — 엔진 등록
4. `web/src/components/games/<name>/` — 게임 UI 작성
5. `web/src/lib/game-registry.tsx` — lazy import 등록
