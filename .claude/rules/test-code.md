# 테스트 코드 작성 가이드

## 프레임워크

- **테스트 러너**: Vitest
- **프론트엔드 테스트**: Vitest + React Testing Library
- **서버 테스트**: Vitest

## 파일 위치 및 네이밍

소스 파일과 같은 디렉토리에 `__tests__/` 폴더를 만들거나, 소스 파일 옆에 `.test.ts(x)` 파일을 둔다.

```
games/
├── gomoku-engine.ts
├── gomoku-engine.test.ts        # 옵션 A: 같은 폴더
└── __tests__/
    └── gomoku-engine.test.ts    # 옵션 B: __tests__ 폴더
```

두 패턴 중 하나를 패키지 내에서 일관되게 사용한다.

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

Socket.IO 이벤트 핸들러는 소켓을 모킹하여 테스트한다:

```typescript
const mockSocket = {
  id: "socket-1",
  join: vi.fn(),
  emit: vi.fn(),
  to: vi.fn(() => ({ emit: vi.fn() })),
  on: vi.fn(),
} as unknown as Socket;

const mockIo = {
  to: vi.fn(() => ({ emit: vi.fn() })),
} as unknown as Server;
```

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

```typescript
import { renderHook } from "@testing-library/react";

describe("useGame", () => {
  it("게임 상태를 반환한다", () => {
    const { result } = renderHook(() => useGame("room-1"));
    expect(result.current.gameState).toBeDefined();
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

### Socket.IO 클라이언트 모킹

```typescript
vi.mock("@/lib/socket", () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
  },
}));
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

## 커버리지 우선순위

1. **게임 로직 (엔진)** — 가장 높은 우선순위. 핵심 로직이므로 높은 커버리지 유지
2. **소켓 핸들러** — 이벤트 처리 정확성 검증
3. **Zustand 스토어** — 상태 변경 로직
4. **커스텀 훅** — 소켓-스토어 연동
5. **UI 컴포넌트** — 렌더링 및 사용자 상호작용
