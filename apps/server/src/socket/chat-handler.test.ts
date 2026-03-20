import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import { setupLobbyHandler } from "./lobby-handler.js";
import { GameManager } from "../games/game-manager.js";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function createMockSocket(id: string, nickname: string) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const toEmit = vi.fn();
  return {
    id,
    data: { playerId: id, nickname, roomId: null as string | null, authenticated: true },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: toEmit })),
    _trigger: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.(...args);
    },
    _toEmit: toEmit,
  } as unknown as GameSocket & {
    _trigger: (event: string, ...args: unknown[]) => void;
    _toEmit: ReturnType<typeof vi.fn>;
  };
}

function createMockIo(): GameServer & { _toEmit: ReturnType<typeof vi.fn> } {
  const toEmit = vi.fn();
  return {
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: toEmit })),
    _toEmit: toEmit,
  } as unknown as GameServer & { _toEmit: ReturnType<typeof vi.fn> };
}

describe("chat:lobby-message", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "Player1");
    io = createMockIo();
    gameManager = new GameManager();
    setupLobbyHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager);
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

  beforeEach(() => {
    socket = createMockSocket("socket-1", "Player1");
    io = createMockIo();
    gameManager = new GameManager();
    setupLobbyHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager);
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
