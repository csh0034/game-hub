import { renderHook, act } from "@testing-library/react";
import { useRanking } from "./use-ranking";
import { useRankingStore } from "@/stores/ranking-store";
import type { RankingEntry } from "@game-hub/shared-types";

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

function createEntry(overrides: Partial<RankingEntry> = {}): RankingEntry {
  return {
    id: "entry-1",
    nickname: "Player1",
    score: 1000,
    gameType: "tetris",
    difficulty: "beginner",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("useRanking", () => {
  beforeEach(() => {
    useRankingStore.setState(useRankingStore.getInitialState());
  });

  it("socket이 null이면 이벤트 리스너를 등록하지 않는다", () => {
    renderHook(() => useRanking(null));
    // No error thrown
  });

  it("ranking:updated 이벤트로 랭킹을 갱신한다", () => {
    const socket = createMockSocket();
    renderHook(() => useRanking(socket as never));
    const entries = [createEntry()];

    act(() => {
      socket._trigger("ranking:updated", { key: "tetris:beginner", rankings: entries });
    });

    expect(useRankingStore.getState().rankings["tetris:beginner"]).toEqual(entries);
  });

  it("fetchRankings가 ranking:get을 emit하고 콜백으로 랭킹을 저장한다", () => {
    const socket = createMockSocket();
    const entries = [createEntry()];
    socket.emit.mockImplementation(((event: string, _key: unknown, callback?: (entries: RankingEntry[]) => void) => {
      if (event === "ranking:get" && callback) callback(entries);
    }) as typeof socket.emit);

    const { result } = renderHook(() => useRanking(socket as never));

    act(() => {
      result.current.fetchRankings("tetris:beginner");
    });

    expect(socket.emit).toHaveBeenCalledWith("ranking:get", "tetris:beginner", expect.any(Function));
    expect(useRankingStore.getState().rankings["tetris:beginner"]).toEqual(entries);
  });

  it("socket이 null이면 fetchRankings가 아무 동작도 하지 않는다", () => {
    const { result } = renderHook(() => useRanking(null));

    act(() => {
      result.current.fetchRankings("tetris:beginner");
    });

    expect(useRankingStore.getState().rankings).toEqual({});
  });

  it("deleteRanking이 ranking:delete를 emit하고 결과를 반환한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, _key: unknown, _entryId: unknown, callback?: (result: { success: boolean }) => void) => {
      if (event === "ranking:delete" && callback) callback({ success: true });
    }) as typeof socket.emit);

    const { result } = renderHook(() => useRanking(socket as never));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.deleteRanking("tetris:beginner", "entry-1");
    });

    expect(response?.success).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith("ranking:delete", "tetris:beginner", "entry-1", expect.any(Function));
  });

  it("socket이 null이면 deleteRanking이 에러 결과를 반환한다", async () => {
    const { result } = renderHook(() => useRanking(null));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.deleteRanking("tetris:beginner", "entry-1");
    });

    expect(response?.success).toBe(false);
    expect(response?.error).toBe("소켓 연결 없음");
  });

  it("언마운트 시 이벤트 리스너를 해제한다", () => {
    const socket = createMockSocket();
    const { unmount } = renderHook(() => useRanking(socket as never));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("ranking:updated", expect.any(Function));
  });
});
