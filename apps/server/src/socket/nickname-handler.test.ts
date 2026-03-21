import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import { setupNicknameHandler } from "./nickname-handler.js";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function createMockSocket(id: string, nickname: string) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    id,
    data: { playerId: id, nickname, roomId: null, authenticated: false },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    join: vi.fn(),
    leave: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.(...args);
    },
  } as unknown as GameSocket & { _trigger: (event: string, ...args: unknown[]) => void };
}

function createMockIo(sockets: GameSocket[]): GameServer {
  const socketMap = new Map(sockets.map((s) => [s.id, s]));
  return {
    sockets: { sockets: socketMap },
    emit: vi.fn(),
  } as unknown as GameServer;
}

describe("setupNicknameHandler", () => {
  let socket: GameSocket & { _trigger: (event: string, ...args: unknown[]) => void };
  let io: GameServer;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "Player_sock") as GameSocket & { _trigger: (event: string, ...args: unknown[]) => void };
    io = createMockIo([socket]);
    setupNicknameHandler(io, socket);
  });

  it("유효한 닉네임을 설정한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
    expect(socket.data.nickname).toBe("홍길동");
    expect(socket.data.authenticated).toBe(true);
    expect(io.emit).toHaveBeenCalledWith("system:player-count", {
      count: 1,
      players: [expect.objectContaining({ nickname: "홍길동" })],
    });
  });

  it("닉네임 앞뒤 공백을 제거한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "  홍길동  ", callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
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

  it("중복 닉네임을 거부한다", () => {
    const otherSocket = createMockSocket("socket-2", "홍길동");
    io = createMockIo([socket, otherSocket]);
    setupNicknameHandler(io, socket);

    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: "이미 사용 중인 닉네임입니다.",
    });
    expect(socket.data.nickname).toBe("Player_sock");
  });

  it("자기 자신의 닉네임과 같은 값으로 변경할 수 있다", () => {
    socket.data.nickname = "홍길동";
    io = createMockIo([socket]);
    setupNicknameHandler(io, socket);

    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
  });

  it("로그아웃 시 authenticated를 false로 설정하고 카운트를 갱신한다", () => {
    const callback = vi.fn();
    socket._trigger("player:set-nickname", "홍길동", callback);
    expect(socket.data.authenticated).toBe(true);

    socket._trigger("player:logout");
    expect(socket.data.authenticated).toBe(false);
    expect(io.emit).toHaveBeenLastCalledWith("system:player-count", { count: 0, players: [] });
  });
});
