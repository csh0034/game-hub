import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatMessage } from "@game-hub/shared-types";
import { setupChatHandler } from "./chat-handler.js";
import { GameManager } from "../games/game-manager.js";
import type { ChatStore } from "../storage/index.js";
import { createMockSocket, createMockIo, type GameServer, type GameSocket } from "./socket-test-helpers.js";

function createMockChatStore(): ChatStore {
  const lobbyMessages: ChatMessage[] = [];
  const roomMessages = new Map<string, ChatMessage[]>();

  return {
    pushLobbyMessage: vi.fn(async (msg: ChatMessage) => {
      lobbyMessages.push(msg);
      if (lobbyMessages.length > 50) lobbyMessages.shift();
    }),
    getLobbyHistory: vi.fn(async () => [...lobbyMessages]),
    pushRoomMessage: vi.fn(async (roomId: string, msg: ChatMessage) => {
      if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
      const msgs = roomMessages.get(roomId)!;
      msgs.push(msg);
      if (msgs.length > 50) msgs.shift();
    }),
    getRoomHistory: vi.fn(async (roomId: string) => [...(roomMessages.get(roomId) ?? [])]),
    deleteRoomHistory: vi.fn(async (roomId: string) => {
      roomMessages.delete(roomId);
    }),
    deleteLobbyMessage: vi.fn(async (messageId: string) => {
      const idx = lobbyMessages.findIndex((m) => m.id === messageId);
      if (idx === -1) return false;
      lobbyMessages.splice(idx, 1);
      return true;
    }),
    deleteRoomMessage: vi.fn(async (roomId: string, messageId: string) => {
      const msgs = roomMessages.get(roomId);
      if (!msgs) return false;
      const idx = msgs.findIndex((m) => m.id === messageId);
      if (idx === -1) return false;
      msgs.splice(idx, 1);
      return true;
    }),
  };
}

describe("chat:lobby-message", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: ChatStore;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "Player1");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = createMockChatStore();
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore);
  });

  it("인증된 유저가 roomId 없을 때 lobby room에 브로드캐스트한다", () => {
    socket.data.authenticated = true;
    socket.data.roomId = null;

    socket._trigger("chat:lobby-message", "안녕하세요");

    expect(io.to).toHaveBeenCalledWith("lobby");
    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:lobby-message",
      expect.objectContaining({
        playerId: "socket-1",
        nickname: "Player1",
        message: "안녕하세요",
      }),
    );
  });

  it("인증되지 않은 유저는 메시지를 보낼 수 없다", () => {
    socket.data.authenticated = false;
    socket.data.roomId = null;

    socket._trigger("chat:lobby-message", "안녕하세요");

    expect(io._toEmit).not.toHaveBeenCalled();
  });

  it("roomId가 있으면 로비 메시지를 무시한다", () => {
    socket.data.authenticated = true;
    socket.data.roomId = "room-1";

    socket._trigger("chat:lobby-message", "안녕하세요");

    expect(io._toEmit).not.toHaveBeenCalled();
  });

  it("관리자 닉네임을 '관리자'로 치환하고 isAdmin 플래그를 설정한다", () => {
    const adminSocket = createMockSocket("socket-admin", "admin");
    setupChatHandler(io as unknown as GameServer, adminSocket as unknown as GameSocket, gameManager, chatStore);
    adminSocket.data.authenticated = true;
    adminSocket.data.roomId = null;

    adminSocket._trigger("chat:lobby-message", "공지사항입니다");

    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:lobby-message",
      expect.objectContaining({
        nickname: "관리자",
        isAdmin: true,
        message: "공지사항입니다",
      }),
    );
  });

  it("메시지를 500자로 잘라서 전송한다", () => {
    socket.data.authenticated = true;
    socket.data.roomId = null;
    const longMessage = "가".repeat(600);

    socket._trigger("chat:lobby-message", longMessage);

    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:lobby-message",
      expect.objectContaining({
        message: "가".repeat(500),
      }),
    );
  });
});

describe("chat:room-message", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: ChatStore;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "Player1");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = createMockChatStore();
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore);
  });

  it("roomId가 있으면 해당 room에 메시지를 전송한다", () => {
    socket.data.roomId = "room-1";

    socket._trigger("chat:room-message", "게임 시작!");

    expect(io.to).toHaveBeenCalledWith("room-1");
    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:room-message",
      expect.objectContaining({
        playerId: "socket-1",
        nickname: "Player1",
        message: "게임 시작!",
      }),
    );
  });

  it("roomId가 없으면 메시지를 무시한다", () => {
    socket.data.roomId = null;

    socket._trigger("chat:room-message", "게임 시작!");

    expect(io._toEmit).not.toHaveBeenCalled();
  });

  it("관리자 닉네임을 '관리자'로 치환하고 isAdmin 플래그를 설정한다", () => {
    const adminSocket = createMockSocket("socket-admin", "admin");
    setupChatHandler(io as unknown as GameServer, adminSocket as unknown as GameSocket, gameManager, chatStore);
    adminSocket.data.roomId = "room-1";

    adminSocket._trigger("chat:room-message", "방 공지");

    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:room-message",
      expect.objectContaining({
        nickname: "관리자",
        isAdmin: true,
        message: "방 공지",
      }),
    );
  });

  it("메시지를 500자로 잘라서 전송한다", () => {
    socket.data.roomId = "room-1";
    const longMessage = "a".repeat(600);

    socket._trigger("chat:room-message", longMessage);

    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:room-message",
      expect.objectContaining({
        message: "a".repeat(500),
      }),
    );
  });
});

describe("chat:request-history", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: ChatStore;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "Player1");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = createMockChatStore();
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore);
  });

  it("로비 메시지 이력을 반환한다", async () => {
    socket.data.authenticated = true;
    socket.data.roomId = null;

    // 메시지 전송하여 이력 쌓기
    socket._trigger("chat:lobby-message", "첫 번째");
    socket._trigger("chat:lobby-message", "두 번째");

    const callback = vi.fn();
    socket._trigger("chat:request-history", "lobby", callback);

    // Wait for async callback
    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: "첫 번째" }),
          expect.objectContaining({ message: "두 번째" }),
        ]),
      );
    });
  });

  it("방 메시지 이력을 반환한다", async () => {
    socket.data.roomId = "room-test";

    socket._trigger("chat:room-message", "방 메시지");

    const callback = vi.fn();
    socket._trigger("chat:request-history", "room", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: "방 메시지" }),
        ]),
      );
    });
  });

  it("인증되지 않은 유저는 빈 배열을 받는다", () => {
    socket.data.authenticated = false;

    const callback = vi.fn();
    socket._trigger("chat:request-history", "lobby", callback);

    expect(callback).toHaveBeenCalledWith([]);
  });

  it("roomId 없이 방 이력 요청 시 빈 배열을 받는다", async () => {
    socket.data.authenticated = true;
    socket.data.roomId = null;

    const callback = vi.fn();
    socket._trigger("chat:request-history", "room", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith([]);
    });
  });
});

describe("chat:delete-message", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: ChatStore;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "admin");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = createMockChatStore();
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore);
  });

  it("admin이 로비 메시지를 삭제한다", async () => {
    socket.data.authenticated = true;
    socket.data.roomId = null;

    // 메시지 전송
    socket._trigger("chat:lobby-message", "삭제할 메시지");

    // 전송된 메시지의 id를 가져옴
    const sentMsg = (io._toEmit as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as ChatMessage;
    expect(sentMsg.id).toBeDefined();

    const callback = vi.fn();
    socket._trigger("chat:delete-message", "lobby", sentMsg.id, callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true, error: undefined });
    });
  });

  it("방 메시지 삭제 요청 시 에러를 반환한다", () => {
    const callback = vi.fn();
    socket._trigger("chat:delete-message", "room", "some-id", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "로비 채팅만 삭제할 수 있습니다." });
  });

  it("admin이 아닌 유저는 삭제할 수 없다", () => {
    const normalSocket = createMockSocket("socket-2", "Player1");
    setupChatHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, gameManager, chatStore);

    const callback = vi.fn();
    normalSocket._trigger("chat:delete-message", "lobby", "some-id", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다." });
  });

  it("존재하지 않는 메시지 삭제 시 실패를 반환한다", async () => {
    socket.data.roomId = null;

    const callback = vi.fn();
    socket._trigger("chat:delete-message", "lobby", "nonexistent-id", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: false, error: "메시지를 찾을 수 없습니다." });
    });
  });
});
