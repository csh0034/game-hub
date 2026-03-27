import { renderHook, act } from "@testing-library/react";
import { useLobby } from "./use-lobby";
import { useLobbyStore } from "@/stores/lobby-store";
import { useGameStore } from "@/stores/game-store";
import type { Room } from "@game-hub/shared-types";

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

function createRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "room-1",
    name: "테스트 방",
    gameType: "gomoku",
    hostId: "host-1",
    players: [],
    spectators: [],
    maxPlayers: 2,
    status: "waiting",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("useLobby", () => {
  beforeEach(() => {
    useLobbyStore.setState(useLobbyStore.getInitialState());
    useGameStore.setState(useGameStore.getInitialState());
  });

  it("마운트 시 lobby:get-rooms를 emit한다", () => {
    const socket = createMockSocket();
    renderHook(() => useLobby(socket as never));
    expect(socket.emit).toHaveBeenCalledWith("lobby:get-rooms", expect.any(Function));
  });

  it("lobby:room-created 이벤트로 방을 추가한다", () => {
    const socket = createMockSocket();
    renderHook(() => useLobby(socket as never));
    const room = createRoom();

    act(() => {
      socket._trigger("lobby:room-created", room);
    });

    expect(useLobbyStore.getState().rooms).toContainEqual(room);
  });

  it("lobby:room-updated 이벤트로 방을 갱신한다", () => {
    useLobbyStore.setState({ rooms: [createRoom()] });
    const socket = createMockSocket();
    renderHook(() => useLobby(socket as never));

    act(() => {
      socket._trigger("lobby:room-updated", createRoom({ name: "업데이트됨" }));
    });

    expect(useLobbyStore.getState().rooms[0].name).toBe("업데이트됨");
  });

  it("lobby:room-removed 이벤트로 방을 제거한다", () => {
    useLobbyStore.setState({ rooms: [createRoom()] });
    const socket = createMockSocket();
    renderHook(() => useLobby(socket as never));

    act(() => {
      socket._trigger("lobby:room-removed", "room-1");
    });

    expect(useLobbyStore.getState().rooms).toHaveLength(0);
  });

  it("createRoom이 lobby:create-room을 emit한다", async () => {
    const socket = createMockSocket();
    const room = createRoom();
    socket.emit.mockImplementation(((event: string, _payload: unknown, callback?: (room: Room) => void) => {
      if (event === "lobby:create-room" && callback) callback(room);
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    let created: Room | undefined;
    await act(async () => {
      created = await result.current.createRoom({ name: "새 방", gameType: "gomoku" });
    });

    expect(created).toEqual(room);
    expect(useLobbyStore.getState().currentRoom).toEqual(room);
  });

  it("joinRoom이 lobby:join-room을 emit하고 성공 시 currentRoom을 설정한다", async () => {
    const socket = createMockSocket();
    const room = createRoom();
    socket.emit.mockImplementation(((event: string, _payload: unknown, callback?: (room: Room | null, error?: string) => void) => {
      if (event === "lobby:join-room" && callback) callback(room);
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await act(async () => {
      await result.current.joinRoom("room-1");
    });

    expect(useLobbyStore.getState().currentRoom).toEqual(room);
  });

  it("joinRoom 실패 시 reject한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, _payload: unknown, callback?: (room: Room | null, error?: string) => void) => {
      if (event === "lobby:join-room" && callback) callback(null, "방이 가득 찼습니다");
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await expect(
      act(() => result.current.joinRoom("room-1")),
    ).rejects.toBe("방이 가득 찼습니다");
  });

  it("leaveRoom이 lobby:leave-room을 emit하고 currentRoom을 null로 설정한다", () => {
    const socket = createMockSocket();
    useLobbyStore.setState({ currentRoom: createRoom() });
    const { result } = renderHook(() => useLobby(socket as never));

    act(() => {
      result.current.leaveRoom();
    });

    expect(socket.emit).toHaveBeenCalledWith("lobby:leave-room");
    expect(useLobbyStore.getState().currentRoom).toBeNull();
  });

  it("toggleReady가 lobby:toggle-ready를 emit한다", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() => useLobby(socket as never));

    act(() => {
      result.current.toggleReady();
    });

    expect(socket.emit).toHaveBeenCalledWith("lobby:toggle-ready");
  });

  it("socket이 null이면 createRoom이 reject한다", async () => {
    const { result } = renderHook(() => useLobby(null));

    await expect(
      act(() => result.current.createRoom({ name: "방", gameType: "gomoku" })),
    ).rejects.toBe("Not connected");
  });

  it("spectateRoom이 lobby:join-spectate를 emit하고 관전 상태를 설정한다", async () => {
    const socket = createMockSocket();
    const room = createRoom();
    socket.emit.mockImplementation(((event: string, _payload: unknown, callback?: (room: Room | null, error?: string) => void) => {
      if (event === "lobby:join-spectate" && callback) callback(room);
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await act(async () => {
      await result.current.spectateRoom("room-1");
    });

    expect(useLobbyStore.getState().currentRoom).toEqual(room);
    expect(useLobbyStore.getState().isSpectating).toBe(true);
  });

  it("spectateRoom 실패 시 reject한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, _payload: unknown, callback?: (room: Room | null, error?: string) => void) => {
      if (event === "lobby:join-spectate" && callback) callback(null, "관전 불가");
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await expect(
      act(() => result.current.spectateRoom("room-1")),
    ).rejects.toBe("관전 불가");
  });

  it("socket이 null이면 spectateRoom이 reject한다", async () => {
    const { result } = renderHook(() => useLobby(null));

    await expect(
      act(() => result.current.spectateRoom("room-1")),
    ).rejects.toBe("Not connected");
  });

  it("kickSpectators가 lobby:kick-spectators를 emit한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, callback?: (result: { success: boolean; error?: string }) => void) => {
      if (event === "lobby:kick-spectators" && callback) callback({ success: true });
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await act(async () => {
      await result.current.kickSpectators();
    });

    expect(socket.emit).toHaveBeenCalledWith("lobby:kick-spectators", expect.any(Function));
  });

  it("kickSpectators 실패 시 reject한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, callback?: (result: { success: boolean; error?: string }) => void) => {
      if (event === "lobby:kick-spectators" && callback) callback({ success: false, error: "권한 없음" });
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await expect(
      act(() => result.current.kickSpectators()),
    ).rejects.toBe("권한 없음");
  });

  it("kickPlayer가 lobby:kick을 emit한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, _targetId: unknown, callback?: (result: { success: boolean; error?: string }) => void) => {
      if (event === "lobby:kick" && callback) callback({ success: true });
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await act(async () => {
      await result.current.kickPlayer("player-2");
    });

    expect(socket.emit).toHaveBeenCalledWith("lobby:kick", "player-2", expect.any(Function));
  });

  it("kickPlayer 실패 시 reject한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, _targetId: unknown, callback?: (result: { success: boolean; error?: string }) => void) => {
      if (event === "lobby:kick" && callback) callback({ success: false, error: "방장만 가능" });
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await expect(
      act(() => result.current.kickPlayer("player-2")),
    ).rejects.toBe("방장만 가능");
  });

  it("switchRole이 lobby:switch-role을 emit하고 관전 상태를 갱신한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, callback?: (result: { success: boolean; role?: string }) => void) => {
      if (event === "lobby:switch-role" && callback) callback({ success: true, role: "spectator" });
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await act(async () => {
      await result.current.switchRole();
    });

    expect(socket.emit).toHaveBeenCalledWith("lobby:switch-role", expect.any(Function));
    expect(useLobbyStore.getState().isSpectating).toBe(true);
  });

  it("switchRole 실패 시 reject한다", async () => {
    const socket = createMockSocket();
    socket.emit.mockImplementation(((event: string, callback?: (result: { success: boolean; error?: string }) => void) => {
      if (event === "lobby:switch-role" && callback) callback({ success: false, error: "전환 불가" });
    }) as typeof socket.emit);

    const { result } = renderHook(() => useLobby(socket as never));

    await expect(
      act(() => result.current.switchRole()),
    ).rejects.toBe("전환 불가");
  });

  it("lobby:spectator-kicked 이벤트로 로비로 복귀한다", () => {
    const socket = createMockSocket();
    useLobbyStore.setState({ currentRoom: createRoom(), isSpectating: true });
    renderHook(() => useLobby(socket as never));

    act(() => {
      socket._trigger("lobby:spectator-kicked");
    });

    expect(useLobbyStore.getState().currentRoom).toBeNull();
    expect(useLobbyStore.getState().isSpectating).toBe(false);
  });

  it("lobby:kicked 이벤트로 로비로 복귀한다", () => {
    const socket = createMockSocket();
    useLobbyStore.setState({ currentRoom: createRoom() });
    renderHook(() => useLobby(socket as never));

    act(() => {
      socket._trigger("lobby:kicked");
    });

    expect(useLobbyStore.getState().currentRoom).toBeNull();
    expect(useLobbyStore.getState().isSpectating).toBe(false);
  });

  it("updateGameOptions가 디바운싱하여 lobby:update-game-options를 emit한다", () => {
    vi.useFakeTimers();
    const socket = createMockSocket();
    const { result } = renderHook(() => useLobby(socket as never));

    act(() => {
      result.current.updateGameOptions({ difficulty: "beginner" } as never);
    });

    // 300ms 전에는 emit하지 않는다
    expect(socket.emit).not.toHaveBeenCalledWith("lobby:update-game-options", expect.anything(), expect.any(Function));

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(socket.emit).toHaveBeenCalledWith("lobby:update-game-options", { difficulty: "beginner" }, expect.any(Function));
    vi.useRealTimers();
  });

  it("socket이 null이면 leaveRoom이 아무 동작도 하지 않는다", () => {
    const { result } = renderHook(() => useLobby(null));

    act(() => {
      result.current.leaveRoom();
    });
    // No error thrown
  });

  it("언마운트 시 이벤트 리스너를 해제한다", () => {
    const socket = createMockSocket();
    const { unmount } = renderHook(() => useLobby(socket as never));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("lobby:room-created");
    expect(socket.off).toHaveBeenCalledWith("lobby:room-updated");
    expect(socket.off).toHaveBeenCalledWith("lobby:room-removed");
    expect(socket.off).toHaveBeenCalledWith("lobby:error");
    expect(socket.off).toHaveBeenCalledWith("lobby:spectator-kicked");
    expect(socket.off).toHaveBeenCalledWith("lobby:kicked");
  });
});
