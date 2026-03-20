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

function createMockIo(): GameServer {
  const toEmit = vi.fn();
  return {
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: toEmit })),
    _toEmit: toEmit,
  } as unknown as GameServer & { _toEmit: ReturnType<typeof vi.fn> };
}

describe("setupLobbyHandler — game:player-left", () => {
  let socket1: ReturnType<typeof createMockSocket>;
  let socket2: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;

  beforeEach(() => {
    socket1 = createMockSocket("socket-1", "Player1");
    socket2 = createMockSocket("socket-2", "Player2");
    io = createMockIo();
    gameManager = new GameManager();
  });

  function setupAndCreateRoom() {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager);

    // Player1 creates a room
    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    // Player2 joins the room
    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);

    return room;
  }

  it("게임 중이 아닐 때 lobby:leave-room 시 game:player-left를 발송하지 않는다", () => {
    const room = setupAndCreateRoom();
    socket2.data.roomId = room.id;

    socket2._trigger("lobby:leave-room");

    // socket.to().emit should not have been called with game:player-left
    const toEmitCalls = socket2._toEmit.mock.calls;
    const playerLeftCalls = toEmitCalls.filter(
      (call: unknown[]) => call[0] === "game:player-left"
    );
    expect(playerLeftCalls).toHaveLength(0);
  });

  it("게임 중일 때 lobby:leave-room 시 game:player-left를 발송한다", () => {
    const room = setupAndCreateRoom();
    socket1.data.roomId = room.id;
    socket2.data.roomId = room.id;

    // Start the game by toggling ready and starting
    gameManager.toggleReady(room.id, "socket-2");
    gameManager.startGame(room.id);

    // Verify the room is now playing
    const playingRoom = gameManager.getRoom(room.id);
    expect(playingRoom?.status).toBe("playing");

    // Player2 leaves during the game
    socket2._trigger("lobby:leave-room");

    const toEmitCalls = socket2._toEmit.mock.calls;
    const playerLeftCalls = toEmitCalls.filter(
      (call: unknown[]) => call[0] === "game:player-left"
    );
    expect(playerLeftCalls).toHaveLength(1);
    expect(playerLeftCalls[0][1]).toEqual({
      playerId: "socket-2",
      nickname: "Player2",
      willEnd: true,
    });
  });

  it("willEnd가 false인 경우 — 남은 인원이 minPlayers 이상", () => {
    // Use texas-holdem which has minPlayers: 2
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager);
    const socket3 = createMockSocket("socket-3", "Player3");
    setupLobbyHandler(io as unknown as GameServer, socket3 as unknown as GameSocket, gameManager);

    // Create holdem room with 3 players
    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "texas-holdem", name: "Holdem Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    const joinCallback2 = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback2);
    const joinCallback3 = vi.fn();
    socket3._trigger("lobby:join-room", { roomId: room.id }, joinCallback3);

    socket1.data.roomId = room.id;
    socket2.data.roomId = room.id;
    socket3.data.roomId = room.id;

    // Ready and start
    gameManager.toggleReady(room.id, "socket-2");
    gameManager.toggleReady(room.id, "socket-3");
    gameManager.startGame(room.id);

    expect(gameManager.getRoom(room.id)?.status).toBe("playing");

    // Player3 leaves — 2 remaining >= minPlayers(2), so willEnd = false
    socket3._trigger("lobby:leave-room");

    const toEmitCalls = socket3._toEmit.mock.calls;
    const playerLeftCalls = toEmitCalls.filter(
      (call: unknown[]) => call[0] === "game:player-left"
    );
    expect(playerLeftCalls).toHaveLength(1);
    expect(playerLeftCalls[0][1]).toMatchObject({
      willEnd: false,
    });
  });
});
