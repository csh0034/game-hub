import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FeatureRequest } from "@game-hub/shared-types";
import { setupRequestHandler } from "./request-handler.js";
import { createMockSocket, createMockIo, type GameServer, type GameSocket } from "./socket-test-helpers.js";
import { InMemoryRequestStore } from "../storage/in-memory/in-memory-request-store.js";

describe("setupRequestHandler", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let requestStore: InMemoryRequestStore;

  beforeEach(() => {
    socket = createMockSocket("socket-1", "admin", { authenticatedAt: Date.now() });
    io = createMockIo();
    requestStore = new InMemoryRequestStore();
  });

  describe("request:get-all", () => {
    it("빈 store에서 빈 배열을 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:get-all", callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith([]);
      });
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
          inProgressAt: null,
          rejectedAt: null,
          resolvedAt: null,
          adminResponse: null,
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
    it("인증된 사용자가 요청을 생성한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "새 기능", description: "설명입니다" }, callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "새 기능",
            description: "설명입니다",
            author: "admin",
            status: "open",
          }),
        );
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:created",
        expect.objectContaining({ title: "새 기능" }),
      );
    });

    it("미인증 사용자는 거부한다", () => {
      const unauthSocket = createMockSocket("socket-2", "Player2", { authenticated: false });
      setupRequestHandler(io as unknown as GameServer, unauthSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      unauthSocket._trigger("request:create", { title: "테스트", description: "설명" }, callback);

      expect(callback).toHaveBeenCalledWith(null, "인증이 필요합니다");
    });

    it("빈 제목은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "", description: "설명" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "제목은 1~100자여야 합니다");
    });

    it("빈 설명은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "제목", description: "" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "설명은 1~1000자여야 합니다");
    });

    it("100자 초과 제목은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "a".repeat(101), description: "설명" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "제목은 1~100자여야 합니다");
    });
  });

  describe("request:accept", () => {
    it("관리자가 open 요청을 수락한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const acceptCallback = vi.fn();
      socket._trigger("request:accept", { requestId: created.id }, acceptCallback);

      await vi.waitFor(() => {
        expect(acceptCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:accepted",
        expect.objectContaining({
          id: created.id,
          status: "in-progress",
          inProgressAt: expect.any(Number),
        }),
      );
    });

    it("adminResponse를 포함하여 수락한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const acceptCallback = vi.fn();
      socket._trigger("request:accept", { requestId: created.id, adminResponse: "확인했습니다" }, acceptCallback);

      await vi.waitFor(() => {
        expect(acceptCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:accepted",
        expect.objectContaining({
          adminResponse: "확인했습니다",
        }),
      );
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      normalSocket._trigger("request:accept", { requestId: "req-1" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("미인증 사용자는 거부한다", () => {
      const unauthSocket = createMockSocket("socket-2", "Player2", { authenticated: false });
      setupRequestHandler(io as unknown as GameServer, unauthSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      unauthSocket._trigger("request:accept", { requestId: "req-1" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "인증이 필요합니다" });
    });

    it("open이 아닌 요청은 수락할 수 없다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 먼저 수락
      const acceptCallback = vi.fn();
      socket._trigger("request:accept", { requestId: created.id }, acceptCallback);
      await vi.waitFor(() => expect(acceptCallback).toHaveBeenCalledWith({ success: true }));

      // 다시 수락 시도
      const acceptCallback2 = vi.fn();
      socket._trigger("request:accept", { requestId: created.id }, acceptCallback2);
      await vi.waitFor(() => {
        expect(acceptCallback2).toHaveBeenCalledWith({ success: false, error: "요청 상태의 항목만 수락할 수 있습니다" });
      });
    });

    it("없는 요청 ID는 에러를 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:accept", { requestId: "nonexistent" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
      });
    });
  });

  describe("request:reject", () => {
    it("관리자가 open 요청을 거부한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const rejectCallback = vi.fn();
      socket._trigger("request:reject", { requestId: created.id, adminResponse: "현재 계획에 없습니다" }, rejectCallback);

      await vi.waitFor(() => {
        expect(rejectCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:rejected",
        expect.objectContaining({
          id: created.id,
          status: "rejected",
          rejectedAt: expect.any(Number),
          adminResponse: "현재 계획에 없습니다",
        }),
      );
    });

    it("관리자가 in-progress 요청을 거부한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 먼저 수락
      const acceptCallback = vi.fn();
      socket._trigger("request:accept", { requestId: created.id }, acceptCallback);
      await vi.waitFor(() => expect(acceptCallback).toHaveBeenCalledWith({ success: true }));

      // 거부
      const rejectCallback = vi.fn();
      socket._trigger("request:reject", { requestId: created.id, adminResponse: "방향 변경" }, rejectCallback);

      await vi.waitFor(() => {
        expect(rejectCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:rejected",
        expect.objectContaining({
          status: "rejected",
          adminResponse: "방향 변경",
        }),
      );
    });

    it("adminResponse 누락 시 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:reject", { requestId: "req-1", adminResponse: "" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "거부 사유를 입력해주세요" });
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      normalSocket._trigger("request:reject", { requestId: "req-1", adminResponse: "사유" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("resolved 상태의 요청은 거부할 수 없다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 완료 처리
      const resolveCallback = vi.fn();
      socket._trigger("request:resolve", { requestId: created.id, commitHash: "abc1234" }, resolveCallback);
      await vi.waitFor(() => expect(resolveCallback).toHaveBeenCalledWith({ success: true }));

      // 거부 시도
      const rejectCallback = vi.fn();
      socket._trigger("request:reject", { requestId: created.id, adminResponse: "사유" }, rejectCallback);
      await vi.waitFor(() => {
        expect(rejectCallback).toHaveBeenCalledWith({ success: false, error: "요청 또는 진행중 상태의 항목만 거부할 수 있습니다" });
      });
    });

    it("없는 요청 ID는 에러를 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:reject", { requestId: "nonexistent", adminResponse: "사유" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
      });
    });
  });

  describe("request:resolve", () => {
    it("관리자가 요청을 완료 처리한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      // 먼저 요청 생성
      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);

      await vi.waitFor(() => {
        expect(createCallback).toHaveBeenCalled();
      });
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 완료 처리
      const resolveCallback = vi.fn();
      socket._trigger("request:resolve", { requestId: created.id, commitHash: "abc1234" }, resolveCallback);

      await vi.waitFor(() => {
        expect(resolveCallback).toHaveBeenCalledWith({ success: true });
      });
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
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      normalSocket._trigger("request:resolve", { requestId: "req-1", commitHash: "abc" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("없는 요청 ID는 에러를 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:resolve", { requestId: "nonexistent", commitHash: "abc" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
      });
    });

    it("빈 커밋 해시는 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:resolve", { requestId: "req-1", commitHash: "" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "커밋 해시를 입력해주세요" });
    });

    it("rejected 상태의 요청은 완료할 수 없다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 거부 처리
      const rejectCallback = vi.fn();
      socket._trigger("request:reject", { requestId: created.id, adminResponse: "사유" }, rejectCallback);
      await vi.waitFor(() => expect(rejectCallback).toHaveBeenCalledWith({ success: true }));

      // 완료 시도
      const resolveCallback = vi.fn();
      socket._trigger("request:resolve", { requestId: created.id, commitHash: "abc1234" }, resolveCallback);
      await vi.waitFor(() => {
        expect(resolveCallback).toHaveBeenCalledWith({ success: false, error: "요청 또는 진행중 상태의 항목만 완료할 수 있습니다" });
      });
    });
  });

  describe("request:delete", () => {
    it("관리자가 요청을 삭제한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      // 먼저 요청 생성
      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "삭제 대상", description: "설명" }, createCallback);

      await vi.waitFor(() => {
        expect(createCallback).toHaveBeenCalled();
      });
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 삭제
      const deleteCallback = vi.fn();
      socket._trigger("request:delete", created.id, deleteCallback);

      await vi.waitFor(() => {
        expect(deleteCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:deleted",
        created.id,
      );
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      normalSocket._trigger("request:delete", "req-1", callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("없는 요청 ID는 에러를 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:delete", "nonexistent", callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
      });
    });
  });
});
