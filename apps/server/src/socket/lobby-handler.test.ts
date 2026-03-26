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

describe("setupLobbyHandler — lobby:get-rooms", () => {
  let socket1: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: InMemoryChatStore;

  beforeEach(() => {
    socket1 = createMockSocket("socket-1", "Player1");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = new InMemoryChatStore();
  });

  it("빈 방 목록을 콜백으로 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const callback = vi.fn();
    socket1._trigger("lobby:get-rooms", callback);

    expect(callback).toHaveBeenCalledWith([]);
  });

  it("생성된 방 목록을 콜백으로 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);

    const getRoomsCallback = vi.fn();
    socket1._trigger("lobby:get-rooms", getRoomsCallback);

    const rooms = getRoomsCallback.mock.calls[0][0];
    expect(rooms).toHaveLength(1);
    expect(rooms[0].name).toBe("Test Room");
  });
});

describe("setupLobbyHandler — lobby:create-room", () => {
  let socket1: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: InMemoryChatStore;

  beforeEach(() => {
    socket1 = createMockSocket("socket-1", "Player1");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = new InMemoryChatStore();
  });

  it("방을 생성하고 콜백으로 방 정보를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const callback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const room = callback.mock.calls[0][0];
    expect(room.name).toBe("Test Room");
    expect(room.gameType).toBe("gomoku");
    expect(room.hostId).toBe("socket-1");
    expect(room.players).toHaveLength(1);
    expect(room.players[0].id).toBe("socket-1");
  });

  it("방 생성 시 lobby:room-created 이벤트를 브로드캐스트한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const callback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, callback);

    const room = callback.mock.calls[0][0];
    expect((io.emit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("lobby:room-created", room);
  });

  it("비활성화된 게임으로 방 생성 시 game:error를 발송한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const callback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "texas-holdem", name: "Holdem Room" }, callback);

    expect(callback).not.toHaveBeenCalled();
    expect((socket1.emit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("game:error", "패치중");
  });

  it("방 생성 시 소켓이 방에 조인한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const callback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, callback);

    const room = callback.mock.calls[0][0];
    expect(socket1.join).toHaveBeenCalledWith(room.id);
    expect(socket1.data.roomId).toBe(room.id);
  });
});

describe("setupLobbyHandler — lobby:join-room", () => {
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

  it("방에 성공적으로 참가한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);

    expect(joinCallback).toHaveBeenCalledTimes(1);
    const joinedRoom = joinCallback.mock.calls[0][0];
    expect(joinedRoom.players).toHaveLength(2);
    expect(socket2.data.roomId).toBe(room.id);
    expect(socket2.join).toHaveBeenCalledWith(room.id);
  });

  it("존재하지 않는 방에 참가하면 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const joinCallback = vi.fn();
    socket1._trigger("lobby:join-room", { roomId: "nonexistent" }, joinCallback);

    expect(joinCallback).toHaveBeenCalledWith(null, "방에 참가할 수 없습니다.");
    expect(socket1.join).toHaveBeenCalledWith("lobby");
  });

  it("방 참가 시 lobby:player-joined 이벤트를 발송한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    socket2._trigger("lobby:join-room", { roomId: room.id }, vi.fn());

    expect(io._toEmit).toHaveBeenCalledWith(
      "lobby:player-joined",
      expect.objectContaining({ id: "socket-2", nickname: "Player2" }),
    );
  });
});

describe("setupLobbyHandler — lobby:leave-room", () => {
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

  it("플레이어가 나가도 방이 유지된다", () => {
    const room = setupAndCreateRoom();
    socket2.data.roomId = room.id;

    socket2._trigger("lobby:leave-room");

    expect(socket2.leave).toHaveBeenCalledWith(room.id);
    expect(socket2.data.roomId).toBeNull();
    expect(socket2.join).toHaveBeenCalledWith("lobby");
    const updatedRoom = gameManager.getRoom(room.id);
    expect(updatedRoom).not.toBeNull();
    expect(updatedRoom!.players).toHaveLength(1);
  });

  it("마지막 플레이어가 나가면 방이 제거된다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Solo Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];
    socket1.data.roomId = room.id;

    socket1._trigger("lobby:leave-room");

    expect(gameManager.getRoom(room.id)).toBeNull();
    expect((io.emit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("lobby:room-removed", room.id);
  });

  it("관전자가 나가면 관전자 목록에서 제거된다", () => {
    const room = setupAndCreateRoom();

    // 관전 허용 활성화
    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    // socket3 관전 참가
    const spectateCallback = vi.fn();
    socket3._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback);
    socket3.data.roomId = room.id;
    socket3.data.isSpectator = true;

    socket3._trigger("lobby:leave-room");

    expect(socket3.data.roomId).toBeNull();
    expect(socket3.data.isSpectator).toBe(false);
    expect(socket3.leave).toHaveBeenCalledWith(room.id);
    expect(socket3.join).toHaveBeenCalledWith("lobby");
    const updatedRoom = gameManager.getRoom(room.id);
    expect(updatedRoom!.spectators).toHaveLength(0);
  });

  it("roomId가 없으면 아무것도 하지 않는다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    socket1.data.roomId = null;

    socket1._trigger("lobby:leave-room");

    expect(socket1.leave).not.toHaveBeenCalled();
  });
});

describe("setupLobbyHandler — lobby:update-game-options", () => {
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

  it("방장이 게임 옵션을 변경한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];
    socket1.data.roomId = room.id;

    const callback = vi.fn();
    socket1._trigger("lobby:update-game-options", { spectateEnabled: true }, callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
    const updatedRoom = gameManager.getRoom(room.id);
    expect(updatedRoom!.gameOptions).toEqual({ spectateEnabled: true });
  });

  it("방에 참가하지 않은 상태에서 옵션 변경 시 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    socket1.data.roomId = null;

    const callback = vi.fn();
    socket1._trigger("lobby:update-game-options", { spectateEnabled: true }, callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "방에 참가하고 있지 않습니다." });
  });

  it("방장이 아닌 사용자가 옵션 변경 시 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);
    socket2.data.roomId = room.id;

    const callback = vi.fn();
    socket2._trigger("lobby:update-game-options", { spectateEnabled: true }, callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "게임 옵션을 변경할 수 없습니다." });
  });
});

describe("setupLobbyHandler — lobby:update-room-name", () => {
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

  it("방장이 방 이름을 변경한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];
    socket1.data.roomId = room.id;

    const callback = vi.fn();
    socket1._trigger("lobby:update-room-name", "새 방이름", callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
    const updatedRoom = gameManager.getRoom(room.id);
    expect(updatedRoom!.name).toBe("새 방이름");
  });

  it("방에 참가하지 않은 상태에서 이름 변경 시 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    socket1.data.roomId = null;

    const callback = vi.fn();
    socket1._trigger("lobby:update-room-name", "새 방이름", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "방에 참가하고 있지 않습니다." });
  });

  it("방장이 아닌 사용자가 이름 변경 시 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);
    socket2.data.roomId = room.id;

    const callback = vi.fn();
    socket2._trigger("lobby:update-room-name", "새 방이름", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "방 이름을 변경할 수 없습니다." });
  });
});

describe("setupLobbyHandler — lobby:toggle-ready", () => {
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

  it("준비 상태를 토글한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);
    socket2.data.roomId = room.id;

    socket2._trigger("lobby:toggle-ready");

    const updatedRoom = gameManager.getRoom(room.id);
    const player2 = updatedRoom!.players.find((p) => p.id === "socket-2");
    expect(player2!.isReady).toBe(true);

    // 다시 토글
    socket2._trigger("lobby:toggle-ready");
    const updatedRoom2 = gameManager.getRoom(room.id);
    const player2Again = updatedRoom2!.players.find((p) => p.id === "socket-2");
    expect(player2Again!.isReady).toBe(false);
  });

  it("관전자는 준비 상태를 토글할 수 없다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];
    socket1.data.roomId = room.id;

    // 관전 허용 활성화
    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    const spectateCallback = vi.fn();
    socket2._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback);
    socket2.data.roomId = room.id;
    socket2.data.isSpectator = true;

    // io._toEmit 초기화
    io._toEmit.mockClear();

    socket2._trigger("lobby:toggle-ready");

    // 관전자의 toggle-ready는 무시되므로 lobby:room-updated가 발생하지 않아야 함
    const roomUpdatedCalls = io._toEmit.mock.calls.filter(
      (call: unknown[]) => call[0] === "lobby:room-updated"
    );
    expect(roomUpdatedCalls).toHaveLength(0);
  });

  it("roomId가 없으면 아무것도 하지 않는다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    socket1.data.roomId = null;

    io._toEmit.mockClear();

    socket1._trigger("lobby:toggle-ready");

    const roomUpdatedCalls = io._toEmit.mock.calls.filter(
      (call: unknown[]) => call[0] === "lobby:room-updated"
    );
    expect(roomUpdatedCalls).toHaveLength(0);
  });
});

describe("setupLobbyHandler — lobby:join-spectate", () => {
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

  it("관전자로 방에 참가한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    // 관전 허용 활성화
    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    const spectateCallback = vi.fn();
    socket2._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback);

    expect(spectateCallback).toHaveBeenCalledTimes(1);
    const joinedRoom = spectateCallback.mock.calls[0][0];
    expect(joinedRoom).not.toBeNull();
    expect(joinedRoom.spectators).toHaveLength(1);
    expect(joinedRoom.spectators[0].id).toBe("socket-2");
    expect(socket2.data.roomId).toBe(room.id);
    expect(socket2.data.isSpectator).toBe(true);
  });

  it("존재하지 않는 방에 관전 시 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);

    const callback = vi.fn();
    socket1._trigger("lobby:join-spectate", { roomId: "nonexistent" }, callback);

    expect(callback).toHaveBeenCalledWith(null, "관전할 수 없습니다.");
    expect(socket1.join).toHaveBeenCalledWith("lobby");
  });

  it("관전 참가 시 lobby:spectator-joined 이벤트를 발송한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    socket2._trigger("lobby:join-spectate", { roomId: room.id }, vi.fn());

    expect(io._toEmit).toHaveBeenCalledWith(
      "lobby:spectator-joined",
      expect.objectContaining({ id: "socket-2", nickname: "Player2" }),
    );
  });

  it("게임 중 관전 입장 시 현재 게임 상태를 전송한다", () => {
    const socket3 = createMockSocket("socket-3", "Player3");
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket3 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true, spectateInGameEnabled: true });

    // socket2 참가 후 게임 시작
    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);
    socket2.data.roomId = room.id;
    socket1._trigger("lobby:toggle-ready");
    socket2._trigger("lobby:toggle-ready");
    gameManager.startGame(room.id);

    // socket3 게임 중 관전 입장
    const spectateCallback = vi.fn();
    socket3._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback);

    expect(spectateCallback).toHaveBeenCalledTimes(1);
    const joinedRoom = spectateCallback.mock.calls[0][0];
    expect(joinedRoom).not.toBeNull();
    expect(joinedRoom.spectators).toHaveLength(1);
    expect(socket3.emit).toHaveBeenCalledWith("game:started", expect.anything());
  });

  it("playing 상태에서 spectateInGameEnabled가 OFF면 관전 입장이 거부된다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    // socket2 참가 후 게임 시작
    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);
    socket2.data.roomId = room.id;
    socket1._trigger("lobby:toggle-ready");
    socket2._trigger("lobby:toggle-ready");
    gameManager.startGame(room.id);

    // 게임 중 관전 시도 (spectateInGameEnabled OFF)
    const socket3 = createMockSocket("socket-3", "Player3");
    setupLobbyHandler(io as unknown as GameServer, socket3 as unknown as GameSocket, gameManager, chatStore);
    const spectateCallback = vi.fn();
    socket3._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback);

    expect(spectateCallback).toHaveBeenCalledWith(null, "관전할 수 없습니다.");
  });
});

describe("setupLobbyHandler — 시스템 메시지", () => {
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

  it("플레이어 입장 시 시스템 메시지를 저장하고 브로드캐스트한다", async () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    socket2._trigger("lobby:join-room", { roomId: room.id }, vi.fn());

    const history = await chatStore.getRoomHistory(room.id);
    expect(history.some((m) => m.playerId === "system" && m.message === "Player2님이 입장했습니다.")).toBe(true);
  });

  it("관전자 입장 시 시스템 메시지를 저장하고 브로드캐스트한다", async () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];
    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    socket2._trigger("lobby:join-spectate", { roomId: room.id }, vi.fn());

    const history = await chatStore.getRoomHistory(room.id);
    expect(history.some((m) => m.playerId === "system" && m.message === "Player2님이 관전을 시작했습니다.")).toBe(true);
  });

  it("플레이어 퇴장 시 시스템 메시지를 저장한다", async () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    socket2._trigger("lobby:join-room", { roomId: room.id }, vi.fn());
    socket2.data.roomId = room.id;
    socket2._trigger("lobby:leave-room");

    const history = await chatStore.getRoomHistory(room.id);
    expect(history.some((m) => m.playerId === "system" && m.message === "Player2님이 퇴장했습니다.")).toBe(true);
  });

  it("관전자 퇴장 시 시스템 메시지를 저장한다", async () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];
    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    socket2._trigger("lobby:join-spectate", { roomId: room.id }, vi.fn());
    socket2.data.roomId = room.id;
    socket2.data.isSpectator = true;
    socket2._trigger("lobby:leave-room");

    const history = await chatStore.getRoomHistory(room.id);
    expect(history.some((m) => m.playerId === "system" && m.message === "Player2님이 관전을 종료했습니다.")).toBe(true);
  });
});

describe("setupLobbyHandler — lobby:kick-spectators", () => {
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

  it("방장이 모든 관전자를 내보낸다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket3 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];
    socket1.data.roomId = room.id;

    // 관전 허용 활성화
    gameManager.updateGameOptions(room.id, "socket-1", { spectateEnabled: true });

    // socket2, socket3 관전 참가
    const spectateCallback2 = vi.fn();
    socket2._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback2);
    socket2.data.roomId = room.id;
    socket2.data.isSpectator = true;

    const spectateCallback3 = vi.fn();
    socket3._trigger("lobby:join-spectate", { roomId: room.id }, spectateCallback3);
    socket3.data.roomId = room.id;
    socket3.data.isSpectator = true;

    const callback = vi.fn();
    socket1._trigger("lobby:kick-spectators", callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
    expect((socket2.emit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("lobby:spectator-kicked");
    expect((socket3.emit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("lobby:spectator-kicked");
    expect(socket2.leave).toHaveBeenCalledWith(room.id);
    expect(socket3.leave).toHaveBeenCalledWith(room.id);

    const updatedRoom = gameManager.getRoom(room.id);
    expect(updatedRoom!.spectators).toHaveLength(0);
  });

  it("방장이 아닌 사용자가 관전자 내보내기를 시도하면 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    setupLobbyHandler(io as unknown as GameServer, socket2 as unknown as GameSocket, gameManager, chatStore);

    const createCallback = vi.fn();
    socket1._trigger("lobby:create-room", { gameType: "gomoku", name: "Test Room" }, createCallback);
    const room = createCallback.mock.calls[0][0];

    const joinCallback = vi.fn();
    socket2._trigger("lobby:join-room", { roomId: room.id }, joinCallback);
    socket2.data.roomId = room.id;

    const callback = vi.fn();
    socket2._trigger("lobby:kick-spectators", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "방장만 관전자를 내보낼 수 있습니다." });
  });

  it("방에 참가하지 않은 상태에서 시도하면 에러를 반환한다", () => {
    setupLobbyHandler(io as unknown as GameServer, socket1 as unknown as GameSocket, gameManager, chatStore);
    socket1.data.roomId = null;

    const callback = vi.fn();
    socket1._trigger("lobby:kick-spectators", callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "방에 참가하고 있지 않습니다." });
  });
});
