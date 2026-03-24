import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupLobbyHandler } from "./lobby-handler.js";
import { GameManager } from "../games/game-manager.js";
import { createMockSocket, createMockIo, type GameServer, type GameSocket } from "./socket-test-helpers.js";
import { InMemoryChatStore } from "../storage/in-memory/in-memory-chat-store.js";

describe("setupLobbyHandler — lobby:kick", () => {
  let socket1: ReturnType<typeof createMockSocket>;
  let socket2: ReturnType<typeof createMockSocket>;
  let socket3: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: InMemoryChatStore;

  beforeEach(() => {
    socket1 = createMockSocket("socket-1", "Player1");
    socket2 = createMockSocket("socket-2", "Player2");
    socket3 = createMockSocket("socket-3", "Player3");
    io = createMockIo({ withTo: true, sockets: [socket1 as unknown as GameSocket, socket2 as unknown as GameSocket, socket3 as unknown as GameSocket] });
    gameManager = new GameManager();
    chatStore = new InMemoryChatStore();
  });

  function setupAndCreateRoom() {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket3 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);

    return room;
  }

  it("방장이 플레이어를 강퇴한다", () => {
    const room = setupAndCreateRoom();
    socket1.data.roomId = room.id;
    socket2.data.roomId = room.id;

    const callback = vi.fn();
    socket1._trigger("lobby:kick", "socket-2", callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
    expect((socket2.emit as ReturnType<typeof vi.fn>).mock.calls.some(
      (call: unknown[]) => call[0] === "lobby:kicked"
    )).toBe(true);
  });

  it("방장이 관전자를 강퇴한다", () => {
    const room = setupAndCreateRoom();
    socket1.data.roomId = room.id;

    // 관전 허용 활성화
    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    // socket3 관전 참가
    const spectateCallback = vi.fn();
    socket3._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback);
    socket3.data.roomId = room.id;
    socket3.data.isSpectator = true;

    const callback = vi.fn();
    socket1._trigger("lobby:kick", "socket-3", callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
    expect((socket3.emit as ReturnType<typeof vi.fn>).mock.calls.some(
      (call: unknown[]) => call[0] === "lobby:kicked"
    )).toBe(true);
  });

  it("방장이 아닌 사용자가 강퇴하면 에러를 반환한다", () => {
    const room = setupAndCreateRoom();
    socket1.data.roomId = room.id;
    socket2.data.roomId = room.id;

    const callback = vi.fn();
    socket2._trigger("lobby:kick", "socket-1", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "방장만 내보낼 수 있습니다." });
  });

  it("자기 자신을 강퇴하면 에러를 반환한다", () => {
    const room = setupAndCreateRoom();
    socket1.data.roomId = room.id;

    const callback = vi.fn();
    socket1._trigger("lobby:kick", "socket-1", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "자기 자신은 내보낼 수 없습니다." });
  });

  it("playing 상태에서 강퇴하면 에러를 반환한다", () => {
    const room = setupAndCreateRoom();
    socket1.data.roomId = room.id;
    socket2.data.roomId = room.id;

    gameManager.toggleReady(room.id, "socket-2");
    gameManager.startGame(room.id);
    expect(gameManager.getRoom(room.id)?.status).toBe("playing");

    const callback = vi.fn();
    socket1._trigger("lobby:kick", "socket-2", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "대기 중일 때만 내보낼 수 있습니다." });
  });

  it("존재하지 않는 대상을 강퇴하면 에러를 반환한다", () => {
    const room = setupAndCreateRoom();
    socket1.data.roomId = room.id;

    const callback = vi.fn();
    socket1._trigger("lobby:kick", "nonexistent-socket", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "대상을 찾을 수 없습니다." });
  });
});

describe("setupLobbyHandler — game:player-left", () => {
  let socket1: ReturnType<typeof createMockSocket>;
  let socket2: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;

  let gameManager: GameManager;
  let chatStore: InMemoryChatStore;

  beforeEach(() => {
    socket1 = createMockSocket("socket-1", "Player1");
    socket2 = createMockSocket("socket-2", "Player2");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = new InMemoryChatStore();
  });

  function setupAndCreateRoom() {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

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

  it("게임 중 이탈 시 항상 willEnd가 true", () => {
    // Use tetris which has minPlayers: 1
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);
    const socket3 = createMockSocket("socket-3", "Player3");
    setupLobbyHandler(io as unknown as GameServer, socket3 as unknown as GameSocket, gameManager, chatStore);

    // Create tetris room with 3 players
    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "tetris", name: "Tetris Room" }, createCallback);
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

    // Player3 leaves — 게임 중 이탈 시 항상 willEnd = true
    socket3._trigger("lobby:leave-room");

    const toEmitCalls = socket3._toEmit.mock.calls;
    const playerLeftCalls = toEmitCalls.filter(
      (call: unknown[]) => call[0] === "game:player-left"
    );
    expect(playerLeftCalls).toHaveLength(1);
    expect(playerLeftCalls[0][1]).toMatchObject({
      willEnd: true,
    });
  });
});
