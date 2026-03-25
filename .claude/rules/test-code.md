# 테스트 코드 작성 가이드

## 프레임워크

- **테스트 러너**: Vitest
- **프론트엔드 테스트**: Vitest + React Testing Library
- **서버 테스트**: Vitest

## 파일 위치 및 네이밍

소스 파일 옆에 `.test.ts(x)` 파일을 둔다.

```
games/
├── gomoku-engine.ts
├── gomoku-engine.test.ts        # 같은 폴더
```

## 네이밍 컨벤션

```typescript
describe("GomokuEngine", () => {
  describe("initState", () => {
    it("15x15 빈 보드를 생성한다", () => { ... });
    it("첫 번째 플레이어를 현재 턴으로 설정한다", () => { ... });
  });

  describe("processMove", () => {
    it("유효한 위치에 돌을 놓는다", () => { ... });
    it("이미 돌이 있는 위치에 놓으면 에러를 던진다", () => { ... });
  });
});
```

- `describe` — 모듈명 또는 함수명
- `it` — 동작 설명 (한글 허용, "~한다" 형태)

## 서버 테스트

### GameEngine 단위 테스트

게임 엔진의 3가지 핵심 메서드를 반드시 테스트한다:

```typescript
describe("GomokuEngine", () => {
  let engine: GomokuEngine;

  beforeEach(() => {
    engine = new GomokuEngine();
  });

  describe("initState", () => {
    it("플레이어 수에 맞는 초기 상태를 반환한다", () => {
      const state = engine.initState(mockPlayers);
      expect(state).toBeDefined();
    });
  });

  describe("processMove", () => {
    it("유효한 이동을 처리하고 새 상태를 반환한다", () => {
      const state = engine.initState(mockPlayers);
      const newState = engine.processMove(state, "player1", validMove);
      expect(newState).not.toBe(state); // 불변성 확인
    });
  });

  describe("checkWin", () => {
    it("승리 조건 충족 시 GameResult를 반환한다", () => {
      const result = engine.checkWin(winningState);
      expect(result).not.toBeNull();
      expect(result?.winnerId).toBe("player1");
    });

    it("게임 진행 중이면 null을 반환한다", () => {
      const result = engine.checkWin(ongoingState);
      expect(result).toBeNull();
    });
  });
});
```

### Socket 핸들러 테스트

`socket/socket-test-helpers.ts`의 공통 헬퍼를 사용한다:

```typescript
import { createMockSocket, createMockIo, type GameServer, type GameSocket } from "./socket-test-helpers.js";

// 기본 (authenticated, emit/to/join/leave 포함)
const socket = createMockSocket("socket-1", "Player1");

// 옵션 커스터마이즈
const socket2 = createMockSocket("socket-2", "Player2", { authenticated: false });

// IO 모킹
const io = createMockIo({ withTo: true });                // to().emit() 필요 시
const io2 = createMockIo({ sockets: [socket, socket2] }); // io.sockets.sockets 필요 시
```

- `socket._trigger(event, ...args)` — 등록된 핸들러 직접 호출
- `socket._toEmit` / `io._toEmit` — `to().emit()` 호출 캡처

## 프론트엔드 테스트

### 컴포넌트 렌더링 테스트

```typescript
import { render, screen } from "@testing-library/react";

describe("GomokuBoard", () => {
  it("보드를 렌더링한다", () => {
    render(<GomokuBoard roomId="room-1" />);
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
```

### Zustand 스토어 테스트

스토어 액션과 상태 변경을 직접 테스트한다:

```typescript
import { useLobbyStore } from "@/stores/lobby-store";

describe("lobby-store", () => {
  beforeEach(() => {
    useLobbyStore.setState(useLobbyStore.getInitialState());
  });

  it("방을 추가한다", () => {
    useLobbyStore.getState().addRoom(mockRoom);
    expect(useLobbyStore.getState().rooms).toContainEqual(mockRoom);
  });
});
```

### 커스텀 훅 테스트

소켓을 인자로 받는 훅은 `createMockSocket()`으로 모킹하고, `as never`로 타입 캐스팅한다:

```typescript
import { renderHook, act } from "@testing-library/react";

describe("useGame", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState());
  });

  it("game:started 이벤트로 게임 상태를 설정한다", () => {
    const socket = createMockSocket();
    renderHook(() => useGame(socket as never));

    act(() => { socket._trigger("game:started", mockState); });
    expect(useGameStore.getState().gameState).toBe(mockState);
  });
});
```

## 공유 타입 테스트

타입 가드나 유틸리티 함수가 있는 경우 테스트한다:

```typescript
describe("isValidGameType", () => {
  it("유효한 게임 타입을 true로 판정한다", () => {
    expect(isValidGameType("gomoku")).toBe(true);
  });

  it("잘못된 값을 false로 판정한다", () => {
    expect(isValidGameType("unknown")).toBe(false);
  });
});
```

## 모킹 패턴

### 프론트엔드 Mock Socket

커스텀 훅 테스트에서는 `createMockSocket()` 헬퍼를 테스트 파일 내에 정의하여 사용한다. `_trigger()`로 서버 이벤트를 시뮬레이션한다:

```typescript
type Handler = (...args: unknown[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Handler[]>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
    id: "test-socket-id",
    _trigger(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
  };
}

// 사용
const socket = createMockSocket();
renderHook(() => useGame(socket as never));
act(() => { socket._trigger("game:started", mockState); });
```

### Zustand 스토어 모킹

```typescript
vi.mock("@/stores/game-store", () => ({
  useGameStore: vi.fn(() => ({
    gameState: mockGameState,
    makeMove: vi.fn(),
  })),
}));
```

## 커버리지

### 우선순위

1. **게임 로직 (엔진)** — 가장 높은 우선순위. 핵심 로직이므로 높은 커버리지 유지
2. **소켓 핸들러** — 이벤트 처리 정확성 검증
3. **Zustand 스토어** — 상태 변경 로직
4. **커스텀 훅** — 소켓-스토어 연동
5. **UI 컴포넌트** — 렌더링 및 사용자 상호작용

### 기준

서버/웹 모두 statements, branches, functions, lines **80%** 이상 (vitest.config의 `thresholds`로 강제).

### 측정 제외 대상

각 패키지의 `vitest.config`에 `exclude`로 정의되며, 제외 기준은 다음과 같다:

**서버** (`apps/server/vitest.config.ts`):
- 테스트 파일 (`*.test.ts`), 테스트 헬퍼 (`socket-test-helpers.ts`)
- 진입점 (`index.ts`) — 서버 부트스트랩, 통합 테스트 영역
- 인터페이스 정의 (`storage/interfaces/**`) — 타입만 존재, 런타임 로직 없음
- 저장소 re-export (`redis/index.ts`, `in-memory/index.ts`) — 모듈 re-export만
- Redis 클라이언트 (`redis-client.ts`) — 외부 연결 싱글톤
- 엔진 인터페이스 (`engine-interface.ts`) — 타입 정의만

**웹** (`apps/web/vitest.config.mts`):
- 테스트 파일 (`*.test.{ts,tsx}`)
- App Router 페이지 (`app/**`) — 리다이렉트/컴포넌트 렌더 위임만
- UI 컴포넌트 (`components/**`) — 우선순위 5, 현재 테스트 대상 외
- Socket.IO 클라이언트 (`lib/socket.ts`) — 외부 라이브러리 래퍼
- 게임 레지스트리 (`lib/game-registry.tsx`) — lazy import 매핑만, 런타임 로직 없음
