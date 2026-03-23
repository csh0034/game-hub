import { renderHook, act } from "@testing-library/react";
import { useGame } from "./use-game";
import { useGameStore } from "@/stores/game-store";
import { useTetrisBoardStore } from "@/stores/tetris-board-store";
import type { GameState, GameResult } from "@game-hub/shared-types";

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

describe("useGame", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState());
    useTetrisBoardStore.setState(useTetrisBoardStore.getInitialState());
  });

  it("socket이 null이면 이벤트 리스너를 등록하지 않는다", () => {
    renderHook(() => useGame(null));
    // No error thrown
  });

  it("game:started 이벤트로 게임 상태를 설정한다", () => {
    const socket = createMockSocket();
    renderHook(() => useGame(socket as never));
    const state = { board: [] } as unknown as GameState;

    act(() => {
      socket._trigger("game:started", state);
    });

    expect(useGameStore.getState().gameState).toBe(state);
    expect(useGameStore.getState().gameResult).toBeNull();
    expect(useGameStore.getState().roundResult).toBeNull();
  });

  it("game:state-updated 이벤트로 게임 상태를 갱신한다", () => {
    const socket = createMockSocket();
    renderHook(() => useGame(socket as never));
    const state = { board: [[]] } as unknown as GameState;

    act(() => {
      socket._trigger("game:state-updated", state);
    });

    expect(useGameStore.getState().gameState).toBe(state);
  });

  it("game:ended 이벤트로 게임 결과를 설정한다", () => {
    const socket = createMockSocket();
    renderHook(() => useGame(socket as never));
    const result: GameResult = { winnerId: "p1", winnerNickname: "승자", reason: "5목 완성" };

    act(() => {
      socket._trigger("game:ended", result);
    });

    expect(useGameStore.getState().gameResult).toEqual(result);
  });

  it("game:private-state 이벤트로 비공개 상태를 설정한다", () => {
    const socket = createMockSocket();
    renderHook(() => useGame(socket as never));
    const privateState = { cards: [{ rank: "A", suit: "spades" }] };

    act(() => {
      socket._trigger("game:private-state", privateState);
    });

    expect(useGameStore.getState().privateState).toBe(privateState);
  });

  it("game:player-left 이벤트로 퇴장 정보를 설정한다", () => {
    const socket = createMockSocket();
    renderHook(() => useGame(socket as never));

    act(() => {
      socket._trigger("game:player-left", { playerId: "p1", nickname: "탈주자", willEnd: true });
    });

    expect(useGameStore.getState().playerLeftInfo).toEqual({ nickname: "탈주자", willEnd: true });
  });

  it("game:round-ended 이벤트로 라운드 결과를 설정한다", () => {
    const socket = createMockSocket();
    renderHook(() => useGame(socket as never));
    const roundResult = {
      winners: [{ playerId: "p1", amount: 100, handName: "원페어" }],
      eliminatedPlayerIds: [],
      nextRoundIn: 3000,
    };

    act(() => {
      socket._trigger("game:round-ended", roundResult);
    });

    expect(useGameStore.getState().roundResult).toEqual(roundResult);
  });

  it("makeMove가 game:move를 emit한다", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() => useGame(socket as never));
    const move = { row: 7, col: 7 };

    act(() => {
      result.current.makeMove(move as never);
    });

    expect(socket.emit).toHaveBeenCalledWith("game:move", move);
  });

  it("startGame이 game:start를 emit한다", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() => useGame(socket as never));

    act(() => {
      result.current.startGame();
    });

    expect(socket.emit).toHaveBeenCalledWith("game:start");
  });

  it("requestRematch가 game:rematch를 emit하고 상태를 초기화한다", () => {
    const socket = createMockSocket();
    useGameStore.getState().setGameState({ board: [] } as unknown as GameState);
    const { result } = renderHook(() => useGame(socket as never));

    act(() => {
      result.current.requestRematch();
    });

    expect(socket.emit).toHaveBeenCalledWith("game:rematch");
    expect(useGameStore.getState().gameState).toBeNull();
  });

  it("socket이 null이면 makeMove가 아무 동작도 하지 않는다", () => {
    const { result } = renderHook(() => useGame(null));

    act(() => {
      result.current.makeMove({ row: 0, col: 0 } as never);
    });
    // No error thrown
  });

  it("언마운트 시 이벤트 리스너를 해제한다", () => {
    const socket = createMockSocket();
    const { unmount } = renderHook(() => useGame(socket as never));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("game:started", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("game:state-updated", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("game:ended", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("game:private-state", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("game:player-left", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("game:round-ended", expect.any(Function));
  });
});
