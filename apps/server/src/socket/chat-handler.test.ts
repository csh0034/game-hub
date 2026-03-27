import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatMessage, CatchMindPublicState, SocketData } from "@game-hub/shared-types";
import { setupChatHandler } from "./chat-handler.js";
import { GameManager } from "../games/game-manager.js";
import type { ChatStore, SessionStore } from "../storage/index.js";
import { createMockSocket, createMockIo, type GameServer, type GameSocket } from "./socket-test-helpers.js";

vi.mock("../games/catch-mind-timer.js", () => ({
  clearCatchMindTimer: vi.fn(),
  startCatchMindTimer: vi.fn(),
}));

vi.mock("./game-handler.js", () => ({
  startCatchMindNextRound: vi.fn(),
}));

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

function createMockSessionStore(): SessionStore {
  const sessions = new Map<string, SocketData>();
  const nicknames = new Map<string, string>();

  return {
    saveSession: vi.fn(async (socketId: string, data: SocketData) => {
      sessions.set(socketId, data);
      if (data.nickname) nicknames.set(data.nickname, socketId);
    }),
    getSession: vi.fn(async (socketId: string) => sessions.get(socketId) ?? null),
    deleteSession: vi.fn(async (socketId: string) => {
      const data = sessions.get(socketId);
      if (data?.nickname) nicknames.delete(data.nickname);
      sessions.delete(socketId);
    }),
    isNicknameTaken: vi.fn(async () => false),
    reserveNickname: vi.fn(async (nickname: string, socketId: string) => {
      nicknames.set(nickname, socketId);
    }),
    releaseNickname: vi.fn(async (nickname: string) => {
      nicknames.delete(nickname);
    }),
    findSessionByNickname: vi.fn(async (nickname: string) => {
      const socketId = nicknames.get(nickname);
      if (!socketId) return null;
      const data = sessions.get(socketId);
      if (!data) return null;
      return { socketId, data };
    }),
  };
}

const dummySessionStore = createMockSessionStore();

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
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
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
    setupChatHandler(io as unknown as GameServer, adminSocket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
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
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
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
    setupChatHandler(io as unknown as GameServer, adminSocket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
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
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
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
    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
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
    setupChatHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);

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

describe("chat:room-message — spectator chat", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: ChatStore;

  beforeEach(() => {
    socket = createMockSocket("spectator-1", "Spectator1");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = createMockChatStore();

    // 방을 만들고 관전자로 설정
    const host = { id: "host-1", nickname: "Host", isReady: false };
    const room = gameManager.createRoom({ name: "테스트방", gameType: "gomoku" }, host);
    socket.data.roomId = room.id;
    socket.data.isSpectator = true;
    gameManager.addSpectator(room.id, { id: "spectator-1", nickname: "Spectator1", isReady: false });
    // spectateEnabled를 켜서 관전자 입장이 가능하도록 설정
    gameManager.updateGameOptions(room.id, "host-1", { spectateEnabled: true, spectateChatEnabled: true });

    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
  });

  it("관전자가 spectateChatEnabled=true일 때 메시지를 전송한다", () => {
    socket._trigger("chat:room-message", "관전자 메시지");

    expect(io.to).toHaveBeenCalledWith(socket.data.roomId);
    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:room-message",
      expect.objectContaining({
        playerId: "spectator-1",
        nickname: "Spectator1",
        message: "관전자 메시지",
        isSpectator: true,
      }),
    );
  });

  it("관전자가 spectateChatEnabled=false일 때 메시지가 차단된다", () => {
    const room = gameManager.getRoom(socket.data.roomId!)!;
    gameManager.updateGameOptions(room.id, "host-1", { spectateEnabled: true, spectateChatEnabled: false });

    socket._trigger("chat:room-message", "차단될 메시지");

    expect(io._toEmit).not.toHaveBeenCalled();
  });

  it("관전자 메시지에 isSpectator 플래그가 설정된다", () => {
    socket._trigger("chat:room-message", "관전 중");

    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:room-message",
      expect.objectContaining({
        isSpectator: true,
      }),
    );
    expect(chatStore.pushRoomMessage).toHaveBeenCalled();
  });
});

describe("chat:room-message — catch-mind integration", () => {
  let drawerSocket: ReturnType<typeof createMockSocket>;
  let guesserSocket: ReturnType<typeof createMockSocket>;
  let guesser2Socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: ChatStore;
  let roomId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = createMockChatStore();

    // 방 생성 및 플레이어 3명 참가
    const host = { id: "drawer-1", nickname: "Drawer", isReady: false };
    const room = gameManager.createRoom({ name: "캐치마인드방", gameType: "catch-mind" }, host);
    roomId = room.id;

    gameManager.joinRoom(roomId, { id: "guesser-1", nickname: "Guesser1", isReady: false });
    gameManager.joinRoom(roomId, { id: "guesser-2", nickname: "Guesser2", isReady: false });

    // 준비 상태 설정 (호스트 제외)
    gameManager.toggleReady(roomId, "guesser-1");
    gameManager.toggleReady(roomId, "guesser-2");

    // 게임 시작
    gameManager.startGame(roomId);

    // drawing 페이즈로 전환
    const cmEngine = gameManager.getCatchMindEngine(roomId)!;
    const state = gameManager.getGameState(roomId) as CatchMindPublicState;
    const drawingState = cmEngine.startDrawingPhase(state);
    gameManager.setGameState(roomId, drawingState);

    // 소켓 생성 — drawerId는 initState에서 players[0]이므로 drawer-1
    drawerSocket = createMockSocket("drawer-1", "Drawer");
    drawerSocket.data.roomId = roomId;
    guesserSocket = createMockSocket("guesser-1", "Guesser1");
    guesserSocket.data.roomId = roomId;
    guesser2Socket = createMockSocket("guesser-2", "Guesser2");
    guesser2Socket.data.roomId = roomId;

    setupChatHandler(io as unknown as GameServer, drawerSocket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
    setupChatHandler(io as unknown as GameServer, guesserSocket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
    setupChatHandler(io as unknown as GameServer, guesser2Socket as unknown as GameSocket, gameManager, chatStore, dummySessionStore);
  });

  it("출제자(drawer)는 drawing 중 채팅이 차단된다", () => {
    drawerSocket._trigger("chat:room-message", "힌트입니다");

    expect(io._toEmit).not.toHaveBeenCalled();
    expect(chatStore.pushRoomMessage).not.toHaveBeenCalled();
  });

  it("이미 정답을 맞힌 플레이어는 채팅이 차단된다", () => {
    // 먼저 정답을 맞힌 상태로 만들기
    const cmEngine = gameManager.getCatchMindEngine(roomId)!;
    const keyword = cmEngine.getKeyword()!;

    // guesser-1이 정답을 맞힘
    guesserSocket._trigger("chat:room-message", keyword);

    // io._toEmit 호출 초기화 (정답 맞힘에 의한 emit들)
    vi.mocked(io._toEmit).mockClear();

    // 이미 맞힌 guesser-1이 다시 채팅
    guesserSocket._trigger("chat:room-message", "또 보내기");

    expect(io._toEmit).not.toHaveBeenCalled();
  });

  it("정답을 맞히면 game:state-updated와 game:catch-mind-correct가 발송된다", () => {
    const cmEngine = gameManager.getCatchMindEngine(roomId)!;
    const keyword = cmEngine.getKeyword()!;

    guesserSocket._trigger("chat:room-message", keyword);

    expect(io._toEmit).toHaveBeenCalledWith("game:state-updated", expect.any(Object));
    expect(io._toEmit).toHaveBeenCalledWith(
      "game:catch-mind-correct",
      expect.objectContaining({
        playerId: "guesser-1",
        nickname: "Guesser1",
        rank: 1,
        score: 3,
      }),
    );
  });

  it("오답은 일반 채팅으로 전송된다", () => {
    guesserSocket._trigger("chat:room-message", "완전히틀린답");

    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:room-message",
      expect.objectContaining({
        playerId: "guesser-1",
        nickname: "Guesser1",
        message: "완전히틀린답",
      }),
    );
    expect(chatStore.pushRoomMessage).toHaveBeenCalled();
  });

  it("모든 플레이어가 맞히면 라운드가 종료된다", async () => {
    const { clearCatchMindTimer } = await import("../games/catch-mind-timer.js");
    const { startCatchMindNextRound } = await import("./game-handler.js");

    const cmEngine = gameManager.getCatchMindEngine(roomId)!;
    const keyword = cmEngine.getKeyword()!;

    // guesser-1이 정답
    guesserSocket._trigger("chat:room-message", keyword);
    // guesser-2가 정답 — 모든 non-drawer 플레이어가 맞힘
    guesser2Socket._trigger("chat:room-message", keyword);

    expect(clearCatchMindTimer).toHaveBeenCalledWith(roomId);
    expect(startCatchMindNextRound).toHaveBeenCalledWith(
      io,
      roomId,
      gameManager,
    );
  });
});

describe("chat:whisper", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let gameManager: GameManager;
  let chatStore: ChatStore;
  let sessionStore: SessionStore;

  beforeEach(async () => {
    socket = createMockSocket("socket-1", "Player1");
    io = createMockIo({ withTo: true });
    gameManager = new GameManager();
    chatStore = createMockChatStore();
    sessionStore = createMockSessionStore();

    // 대상 유저 세션 등록
    await sessionStore.saveSession("socket-2", {
      playerId: "socket-2",
      nickname: "Player2",
      roomId: null,
      authenticated: true,
      authenticatedAt: Date.now(),
    });
    await sessionStore.reserveNickname("Player2", "socket-2");

    setupChatHandler(io as unknown as GameServer, socket as unknown as GameSocket, gameManager, chatStore, sessionStore);
  });

  it("정상적으로 귓속말을 전송한다", async () => {
    socket.data.authenticated = true;
    const callback = vi.fn();

    socket._trigger("chat:whisper", { targetNickname: "Player2", message: "안녕" }, callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true });
    });
    expect(io.to).toHaveBeenCalledWith("socket-2");
    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:whisper-received",
      expect.objectContaining({
        fromNickname: "Player1",
        message: "안녕",
      }),
    );
  });

  it("인증되지 않은 유저는 귓속말을 보낼 수 없다", () => {
    socket.data.authenticated = false;
    const callback = vi.fn();

    socket._trigger("chat:whisper", { targetNickname: "Player2", message: "안녕" }, callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "인증이 필요합니다." });
  });

  it("존재하지 않는 대상에게는 보낼 수 없다", async () => {
    socket.data.authenticated = true;
    const callback = vi.fn();

    socket._trigger("chat:whisper", { targetNickname: "없는유저", message: "안녕" }, callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: false, error: "접속 중이 아닌 사용자입니다." });
    });
  });

  it("자기 자신에게는 보낼 수 없다", () => {
    socket.data.authenticated = true;
    const callback = vi.fn();

    socket._trigger("chat:whisper", { targetNickname: "Player1", message: "안녕" }, callback);

    expect(callback).toHaveBeenCalledWith({ success: false, error: "자신에게는 귓속말을 보낼 수 없습니다." });
  });

  it("메시지를 500자로 잘라서 전송한다", async () => {
    socket.data.authenticated = true;
    const callback = vi.fn();
    const longMessage = "가".repeat(600);

    socket._trigger("chat:whisper", { targetNickname: "Player2", message: longMessage }, callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true });
    });
    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:whisper-received",
      expect.objectContaining({
        message: "가".repeat(500),
      }),
    );
  });

  it("관리자 닉네임은 '관리자'로 변환된다", async () => {
    const adminSocket = createMockSocket("socket-admin", "admin");
    setupChatHandler(io as unknown as GameServer, adminSocket as unknown as GameSocket, gameManager, chatStore, sessionStore);
    adminSocket.data.authenticated = true;
    const callback = vi.fn();

    adminSocket._trigger("chat:whisper", { targetNickname: "Player2", message: "관리자 귓속말" }, callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true });
    });
    expect(io._toEmit).toHaveBeenCalledWith(
      "chat:whisper-received",
      expect.objectContaining({
        fromNickname: "관리자",
      }),
    );
  });
});
