import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupNicknameHandler } from "./nickname-handler.js";
import { createMockSocket, createMockIo } from "./socket-test-helpers.js";
import { InMemorySessionStore } from "../storage/in-memory/in-memory-session-store.js";
import { GameManager } from "../games/game-manager.js";

describe("setupNicknameHandler", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let sessionStore: InMemorySessionStore;
  let gameManager: GameManager;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "Player_sock", { authenticated: false });
    io = createMockIo({ sockets: [socket] });
    sessionStore = new InMemorySessionStore();
    gameManager = new GameManager();
    setupNicknameHandler(io, socket, sessionStore, gameManager);
  });

  it("유효한 닉네임을 설정한다", async () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", "browser-1", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true, isAdmin: false, githubRepoUrl: "https://github.com/csh0034/game-hub" });
    });
    expect(socket.data.nickname).toBe("홍길동");
    expect(socket.data.authenticated).toBe(true);
    expect(socket.data.browserId).toBe("browser-1");
    expect(io.emit).toHaveBeenCalledWith("system:player-count", {
      count: 1,
      players: [expect.objectContaining({ nickname: "홍길동" })],
    });
  });

  it("닉네임 앞뒤 공백을 제거한다", async () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "  홍길동  ", "browser-1", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true, isAdmin: false, githubRepoUrl: "https://github.com/csh0034/game-hub" });
    });
    expect(socket.data.nickname).toBe("홍길동");
  });

  it("3자 미만 닉네임을 거부한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "ab", "browser-1", callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "닉네임은 3자 이상 20자 이하로 입력해주세요.",
    });
    expect(socket.data.nickname).toBe("Player_sock");
  });

  it("20자 초과 닉네임을 거부한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "a".repeat(21), "browser-1", callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "닉네임은 3자 이상 20자 이하로 입력해주세요.",
    });
    expect(socket.data.nickname).toBe("Player_sock");
  });

  it("'관리자' 닉네임을 거부한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "관리자", "browser-1", callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "사용할 수 없는 닉네임입니다.",
    });
    expect(socket.data.nickname).toBe("Player_sock");
  });

  it("공백만 있는 닉네임을 거부한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "   ", "browser-1", callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "닉네임은 3자 이상 20자 이하로 입력해주세요.",
    });
  });

  describe("닉네임 충돌", () => {
    it("같은 브라우저에서 중복 닉네임 시 기존 소켓을 강제 로그아웃한다", async () => {
      const otherSocket = createMockSocket("socket-2", "홍길동", { authenticated: true });
      otherSocket.data.browserId = "browser-A";
      io = createMockIo({ sockets: [socket, otherSocket] });
      await sessionStore.reserveNickname("홍길동", "socket-2");
      await sessionStore.saveSession("socket-2", otherSocket.data);
      setupNicknameHandler(io, socket, sessionStore, gameManager);

      const callback = vi.fn();
      socket._trigger("player:set-nickname", "홍길동", "browser-A", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({
          success: true,
          isAdmin: false,
          githubRepoUrl: "https://github.com/csh0034/game-hub",
        });
      });
      expect(socket.data.nickname).toBe("홍길동");
      expect(otherSocket.emit).toHaveBeenCalledWith("player:force-logout");
      expect(otherSocket.data.authenticated).toBe(false);
      expect(otherSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it("다른 브라우저에서 중복 닉네임 시 거부한다", async () => {
      const otherSocket = createMockSocket("socket-2", "홍길동", { authenticated: true });
      otherSocket.data.browserId = "browser-A";
      io = createMockIo({ sockets: [socket, otherSocket] });
      await sessionStore.reserveNickname("홍길동", "socket-2");
      await sessionStore.saveSession("socket-2", otherSocket.data);
      setupNicknameHandler(io, socket, sessionStore, gameManager);

      const callback = vi.fn();
      socket._trigger("player:set-nickname", "홍길동", "browser-B", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({
          success: false,
          error: "이미 사용 중인 닉네임입니다.",
        });
      });
      // 기존 소켓이 영향받지 않아야 한다
      expect(otherSocket.emit).not.toHaveBeenCalledWith("player:force-logout");
      expect(otherSocket.disconnect).not.toHaveBeenCalled();
      expect(otherSocket.data.authenticated).toBe(true);
    });
  });

  it("자기 자신의 닉네임과 같은 값으로 변경할 수 있다", async () => {
    socket.data.nickname = "홍길동";
    await sessionStore.reserveNickname("홍길동", "socket-1");
    io = createMockIo({ sockets: [socket] });
    setupNicknameHandler(io, socket, sessionStore, gameManager);

    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", "browser-1", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true, isAdmin: false, githubRepoUrl: "https://github.com/csh0034/game-hub" });
    });
  });

  it("로그아웃 시 authenticated를 false로 설정하고 카운트를 갱신한다", async () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", "browser-1", callback);
    await vi.waitFor(() => {
      expect(socket.data.authenticated).toBe(true);
    });

    socket._trigger("player:logout");
    await vi.waitFor(() => {
      expect(socket.data.authenticated).toBe(false);
    });
    expect(io.emit).toHaveBeenLastCalledWith("system:player-count", { count: 0, players: [] });
  });

  describe("재접속", () => {
    let oldSocket: ReturnType<typeof createMockSocket>;
    let newSocket: ReturnType<typeof createMockSocket>;

    beforeEach(() => {
      oldSocket = createMockSocket("old-socket", "홍길동");
      oldSocket.data.browserId = "browser-A";
      newSocket = createMockSocket("new-socket", "NewPlayer", { authenticated: false });
    });

    it("이전 소켓이 끊어진 닉네임으로 재접속하면 성공한다", async () => {
      // 이전 소켓의 세션을 저장하되, io.sockets.sockets에는 포함하지 않음 (disconnected)
      await sessionStore.reserveNickname("홍길동", "old-socket");
      await sessionStore.saveSession("old-socket", oldSocket.data);

      // io에 newSocket만 포함 (oldSocket은 disconnected)
      io = createMockIo({ sockets: [newSocket] });
      setupNicknameHandler(io, newSocket, sessionStore, gameManager);

      const callback = vi.fn();
      newSocket._trigger("player:set-nickname", "홍길동", "browser-A", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({
          success: true,
          isAdmin: false,
          githubRepoUrl: "https://github.com/csh0034/game-hub",
        });
      });
      expect(newSocket.data.nickname).toBe("홍길동");
      expect(newSocket.data.authenticated).toBe(true);
    });

    it("이전 소켓이 끊어졌으면 다른 브라우저에서도 닉네임을 사용할 수 있다", async () => {
      await sessionStore.reserveNickname("홍길동", "old-socket");
      await sessionStore.saveSession("old-socket", oldSocket.data);

      io = createMockIo({ sockets: [newSocket] });
      setupNicknameHandler(io, newSocket, sessionStore, gameManager);

      const callback = vi.fn();
      newSocket._trigger("player:set-nickname", "홍길동", "browser-B", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({
          success: true,
          isAdmin: false,
          githubRepoUrl: "https://github.com/csh0034/game-hub",
        });
      });
      expect(newSocket.data.nickname).toBe("홍길동");
    });

    it("재접속 시 이전 방 멤버십이 복원된다", async () => {
      // 방 생성 및 이전 소켓을 플레이어로 등록
      const room = gameManager.createRoom(
        { name: "테스트방", gameType: "gomoku", gameOptions: {} },
        { id: "old-socket", nickname: "홍길동", isReady: false },
      );
      const roomId = room.id;

      // 이전 소켓의 세션에 roomId 설정
      oldSocket.data.roomId = roomId;
      await sessionStore.reserveNickname("홍길동", "old-socket");
      await sessionStore.saveSession("old-socket", oldSocket.data);

      // io에 newSocket만 포함, withTo 활성화
      io = createMockIo({ sockets: [newSocket], withTo: true });
      setupNicknameHandler(io, newSocket, sessionStore, gameManager);

      const callback = vi.fn();
      newSocket._trigger("player:set-nickname", "홍길동", "browser-A", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({
          success: true,
          isAdmin: false,
          githubRepoUrl: "https://github.com/csh0034/game-hub",
        });
      });

      // 방에 join했는지 확인
      expect(newSocket.join).toHaveBeenCalledWith(roomId);
      expect(newSocket.data.roomId).toBe(roomId);

      // 방 업데이트 이벤트가 브로드캐스트되었는지 확인
      expect(io.to).toHaveBeenCalledWith(roomId);
      expect(io._toEmit).toHaveBeenCalledWith("lobby:room-updated", expect.objectContaining({ id: roomId }));

      // 방의 플레이어 ID가 교체되었는지 확인
      const updatedRoom = gameManager.getRoom(roomId);
      expect(updatedRoom!.players[0].id).toBe("new-socket");
      expect(updatedRoom!.hostId).toBe("new-socket");
    });

    it("재접속 시 방 내 닉네임이 동기화된다", async () => {
      // 방 생성 및 이전 소켓을 플레이어로 등록 (기본 닉네임)
      const room = gameManager.createRoom(
        { name: "테스트방", gameType: "gomoku", gameOptions: {} },
        { id: "old-socket", nickname: "Player_old", isReady: false },
      );
      const roomId = room.id;

      oldSocket.data.roomId = roomId;
      await sessionStore.reserveNickname("홍길동", "old-socket");
      await sessionStore.saveSession("old-socket", oldSocket.data);

      io = createMockIo({ sockets: [newSocket], withTo: true });
      setupNicknameHandler(io, newSocket, sessionStore, gameManager);

      const callback = vi.fn();
      newSocket._trigger("player:set-nickname", "홍길동", "browser-A", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({
          success: true,
          isAdmin: false,
          githubRepoUrl: "https://github.com/csh0034/game-hub",
        });
      });

      // 방의 플레이어 닉네임이 동기화되었는지 확인
      const updatedRoom = gameManager.getRoom(roomId);
      expect(updatedRoom!.players[0].nickname).toBe("홍길동");
    });

    it("재접속 시 관전자 상태가 복원된다", async () => {
      // 방 생성 (다른 호스트)
      const room = gameManager.createRoom(
        { name: "테스트방", gameType: "gomoku", gameOptions: {} },
        { id: "host-socket", nickname: "호스트", isReady: false },
      );
      const roomId = room.id;

      // 이전 소켓을 관전자로 등록
      room.spectators.push({ id: "old-socket", nickname: "홍길동", isReady: false });

      // 이전 소켓의 세션에 roomId와 isSpectator 설정
      oldSocket.data.roomId = roomId;
      oldSocket.data.isSpectator = true;
      await sessionStore.reserveNickname("홍길동", "old-socket");
      await sessionStore.saveSession("old-socket", oldSocket.data);

      // io에 newSocket만 포함, withTo 활성화
      io = createMockIo({ sockets: [newSocket], withTo: true });
      setupNicknameHandler(io, newSocket, sessionStore, gameManager);

      const callback = vi.fn();
      newSocket._trigger("player:set-nickname", "홍길동", "browser-A", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({
          success: true,
          isAdmin: false,
          githubRepoUrl: "https://github.com/csh0034/game-hub",
        });
      });

      // 관전자 상태가 복원되었는지 확인
      expect(newSocket.data.isSpectator).toBe(true);
      expect(newSocket.data.roomId).toBe(roomId);
      expect(newSocket.join).toHaveBeenCalledWith(roomId);
    });
  });
});
