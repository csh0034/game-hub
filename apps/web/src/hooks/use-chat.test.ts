import { renderHook, act } from "@testing-library/react";
import { useChat } from "./use-chat";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage } from "@game-hub/shared-types";

type Handler = (...args: unknown[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Handler[]>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    }),
    off: vi.fn((event: string, handler?: Handler) => {
      if (handler) {
        const list = handlers.get(event);
        if (list) handlers.set(event, list.filter((h) => h !== handler));
      } else {
        handlers.delete(event);
      }
    }),
    emit: vi.fn(),
    connected: true,
    id: "test-socket-id",
    _trigger(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
  };
}

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random()}`,
    playerId: "p1",
    nickname: "테스터",
    message: "안녕",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("useChat", () => {
  beforeEach(() => {
    useChatStore.setState(useChatStore.getInitialState());
  });

  it("socket이 null이면 이벤트 리스너를 등록하지 않는다", () => {
    renderHook(() => useChat(null));
    // No error thrown
  });

  it("chat:lobby-message 이벤트를 수신하면 스토어에 추가한다", () => {
    const socket = createMockSocket();
    renderHook(() => useChat(socket as never));

    const msg = createMessage();
    act(() => {
      socket._trigger("chat:lobby-message", msg);
    });

    expect(useChatStore.getState().lobbyMessages).toContainEqual(msg);
  });

  it("chat:room-message 이벤트를 수신하면 스토어에 추가한다", () => {
    const socket = createMockSocket();
    renderHook(() => useChat(socket as never));

    const msg = createMessage();
    act(() => {
      socket._trigger("chat:room-message", msg);
    });

    expect(useChatStore.getState().roomMessages).toContainEqual(msg);
  });

  it("chat:message-deleted 이벤트로 로비 메시지를 제거한다", () => {
    const msg = createMessage({ id: "del-1" });
    useChatStore.setState({ lobbyMessages: [msg] });
    const socket = createMockSocket();
    renderHook(() => useChat(socket as never));

    act(() => {
      socket._trigger("chat:message-deleted", { target: "lobby", messageId: "del-1" });
    });

    expect(useChatStore.getState().lobbyMessages).toHaveLength(0);
  });

  it("chat:message-deleted 이벤트로 방 메시지를 제거한다", () => {
    const msg = createMessage({ id: "del-2" });
    useChatStore.setState({ roomMessages: [msg] });
    const socket = createMockSocket();
    renderHook(() => useChat(socket as never));

    act(() => {
      socket._trigger("chat:message-deleted", { target: "room", messageId: "del-2" });
    });

    expect(useChatStore.getState().roomMessages).toHaveLength(0);
  });

  it("sendLobbyMessage가 chat:lobby-message를 emit한다", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() => useChat(socket as never));

    act(() => {
      result.current.sendLobbyMessage("안녕하세요");
    });

    expect(socket.emit).toHaveBeenCalledWith("chat:lobby-message", "안녕하세요");
  });

  it("sendRoomMessage가 chat:room-message를 emit한다", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() => useChat(socket as never));

    act(() => {
      result.current.sendRoomMessage("방 메시지");
    });

    expect(socket.emit).toHaveBeenCalledWith("chat:room-message", "방 메시지");
  });

  it("requestLobbyHistory가 chat:request-history를 emit한다", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() => useChat(socket as never));

    act(() => {
      result.current.requestLobbyHistory();
    });

    expect(socket.emit).toHaveBeenCalledWith("chat:request-history", "lobby", expect.any(Function));
  });

  it("언마운트 시 이벤트 리스너를 해제한다", () => {
    const socket = createMockSocket();
    const { unmount } = renderHook(() => useChat(socket as never));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("chat:lobby-message", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("chat:room-message", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("chat:message-deleted", expect.any(Function));
  });
});
