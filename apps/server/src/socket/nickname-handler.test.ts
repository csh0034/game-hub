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
    socket._trigger("player:set-nickname", "홍길동", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true, isAdmin: false, githubRepoUrl: "https://github.com/csh0034/game-hub" });
    });
    expect(socket.data.nickname).toBe("홍길동");
    expect(socket.data.authenticated).toBe(true);
    expect(io.emit).toHaveBeenCalledWith("system:player-count", {
      count: 1,
      players: [expect.objectContaining({ nickname: "홍길동" })],
    });
  });

  it("닉네임 앞뒤 공백을 제거한다", async () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "  홍길동  ", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true, isAdmin: false, githubRepoUrl: "https://github.com/csh0034/game-hub" });
    });
    expect(socket.data.nickname).toBe("홍길동");
  });

  it("3자 미만 닉네임을 거부한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "ab", callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "닉네임은 3자 이상 20자 이하로 입력해주세요.",
    });
    expect(socket.data.nickname).toBe("Player_sock");
  });

  it("20자 초과 닉네임을 거부한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "a".repeat(21), callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "닉네임은 3자 이상 20자 이하로 입력해주세요.",
    });
    expect(socket.data.nickname).toBe("Player_sock");
  });

  it("공백만 있는 닉네임을 거부한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "   ", callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "닉네임은 3자 이상 20자 이하로 입력해주세요.",
    });
  });

  it("중복 닉네임을 거부한다", async () => {
    const otherSocket = createMockSocket("socket-2", "홍길동", { authenticated: false });
    io = createMockIo({ sockets: [socket, otherSocket] });
    // 다른 소켓이 닉네임을 예약한 상태
    await sessionStore.reserveNickname("홍길동", "socket-2");
    await sessionStore.saveSession("socket-2", otherSocket.data);
    setupNicknameHandler(io, socket, sessionStore, gameManager);

    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: "이미 사용 중인 닉네임입니다.",
      });
    });
    expect(socket.data.nickname).toBe("Player_sock");
  });

  it("자기 자신의 닉네임과 같은 값으로 변경할 수 있다", async () => {
    socket.data.nickname = "홍길동";
    await sessionStore.reserveNickname("홍길동", "socket-1");
    io = createMockIo({ sockets: [socket] });
    setupNicknameHandler(io, socket, sessionStore, gameManager);

    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ success: true, isAdmin: false, githubRepoUrl: "https://github.com/csh0034/game-hub" });
    });
  });

  it("로그아웃 시 authenticated를 false로 설정하고 카운트를 갱신한다", async () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", callback);
    await vi.waitFor(() => {
      expect(socket.data.authenticated).toBe(true);
    });

    socket._trigger("player:logout");
    await vi.waitFor(() => {
      expect(socket.data.authenticated).toBe(false);
    });
    expect(io.emit).toHaveBeenLastCalledWith("system:player-count", { count: 0, players: [] });
  });
});
