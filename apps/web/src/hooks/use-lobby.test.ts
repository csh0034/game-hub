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
});
