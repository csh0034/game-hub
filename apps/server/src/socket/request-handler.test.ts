import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  FeatureRequest,
} from "@game-hub/shared-types";
import { setupRequestHandler } from "./request-handler.js";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function createMockSocket(id: string, nickname: string, authenticated = true) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    id,
    data: {
      playerId: id,
      nickname,
      roomId: null as string | null,
      authenticated,
      authenticatedAt: Date.now(),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    emit: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.(...args);
    },
  } as unknown as GameSocket & {
    _trigger: (event: string, ...args: unknown[]) => void;
  };
}

function createMockIo(): GameServer {
  return {
    emit: vi.fn(),
  } as unknown as GameServer;
}

describe("setupRequestHandler", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "admin");
    io = createMockIo();
  });

  describe("request:get-all", () => {
    it("store 없을 때 빈 배열을 반환한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:get-all", callback);
      expect(callback).toHaveBeenCalledWith([]);
    });

    it("store가 있으면 목록을 반환한다", async () => {
      const requests: FeatureRequest[] = [
        {
          id: "req-1",
          title: "테스트",
          description: "설명",
          author: "admin",
          status: "open",
          createdAt: 1000,
          resolvedAt: null,
          commitHash: null,
          commitUrl: null,
        },
      ];
      const mockStore = {
        getAllRequests: vi.fn().mockResolvedValue(requests),
        createRequest: vi.fn(),
        getRequest: vi.fn(),
        updateRequest: vi.fn(),
        deleteRequest: vi.fn(),
      };

      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, mockStore);
      const callback = vi.fn();
      socket._trigger("request:get-all", callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith(requests);
      });
    });
  });

  describe("request:create", () => {
    it("인증된 사용자가 요청을 생성한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "새 기능", description: "설명입니다" }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "새 기능",
          description: "설명입니다",
          author: "admin",
          status: "open",
        }),
      );
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:created",
        expect.objectContaining({ title: "새 기능" }),
      );
    });

    it("미인증 사용자는 거부한다", () => {
      const unauthSocket = createMockSocket("socket-2", "Player2", false);
      setupRequestHandler(io as unknown as GameServer, unauthSocket as unknown as GameSocket);
      const callback = vi.fn();
      unauthSocket._trigger("request:create", { title: "테스트", description: "설명" }, callback);

      expect(callback).toHaveBeenCalledWith(null, "인증이 필요합니다");
    });

    it("빈 제목은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "", description: "설명" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "제목은 1~100자여야 합니다");
    });

    it("빈 설명은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "제목", description: "" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "설명은 1~1000자여야 합니다");
    });

    it("100자 초과 제목은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "a".repeat(101), description: "설명" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "제목은 1~100자여야 합니다");
    });
  });

  describe("request:resolve", () => {
    it("관리자가 요청을 완료 처리한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);

      // 먼저 요청 생성
      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 완료 처리
      const resolveCallback = vi.fn();
      socket._trigger("request:resolve", { requestId: created.id, commitHash: "abc1234" }, resolveCallback);

      expect(resolveCallback).toHaveBeenCalledWith({ success: true });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:resolved",
        expect.objectContaining({
          id: created.id,
          status: "resolved",
          commitHash: "abc1234",
        }),
      );
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket);
      const callback = vi.fn();
      normalSocket._trigger("request:resolve", { requestId: "req-1", commitHash: "abc" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("없는 요청 ID는 에러를 반환한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:resolve", { requestId: "nonexistent", commitHash: "abc" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
    });

    it("빈 커밋 해시는 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:resolve", { requestId: "req-1", commitHash: "" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "커밋 해시를 입력해주세요" });
    });
  });

  describe("request:delete", () => {
    it("관리자가 요청을 삭제한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);

      // 먼저 요청 생성
      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "삭제 대상", description: "설명" }, createCallback);
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 삭제
      const deleteCallback = vi.fn();
      socket._trigger("request:delete", created.id, deleteCallback);

      expect(deleteCallback).toHaveBeenCalledWith({ success: true });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:deleted",
        created.id,
      );
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket);
      const callback = vi.fn();
      normalSocket._trigger("request:delete", "req-1", callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("없는 요청 ID는 에러를 반환한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket);
      const callback = vi.fn();
      socket._trigger("request:delete", "nonexistent", callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
    });
  });
});
