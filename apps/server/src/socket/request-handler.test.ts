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
          label: "feature",
          author: "admin",
          status: "open",
          createdAt: 1000,
          inProgressAt: null,
          rejectedAt: null,
          resolvedAt: null,
          stoppedAt: null,
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
      socket._trigger("request:create", { title: "새 기능", description: "설명입니다", label: "bug" }, callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "새 기능",
            description: "설명입니다",
            label: "bug",
            author: "관리자",
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
      unauthSocket._trigger("request:create", { title: "테스트", description: "설명", label: "feature" }, callback);

      expect(callback).toHaveBeenCalledWith(null, "인증이 필요합니다");
    });

    it("빈 제목은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "", description: "설명", label: "feature" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "제목은 1~100자여야 합니다");
    });

    it("빈 설명은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "제목", description: "", label: "feature" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "설명은 1~1000자여야 합니다");
    });

    it("유효하지 않은 label은 기본값 feature로 설정한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "테스트", description: "설명", label: "invalid" as never }, callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            label: "feature",
          }),
        );
      });
    });

    it("100자 초과 제목은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:create", { title: "a".repeat(101), description: "설명", label: "feature" }, callback);
      expect(callback).toHaveBeenCalledWith(null, "제목은 1~100자여야 합니다");
    });
  });

  describe("request:change-status", () => {
    it("관리자가 요청 상태를 in-progress로 변경한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const callback = vi.fn();
      socket._trigger("request:change-status", { requestId: created.id, status: "in-progress" }, callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:status-changed",
        expect.objectContaining({
          id: created.id,
          status: "in-progress",
          inProgressAt: expect.any(Number),
        }),
      );
    });

    it("관리자가 요청 상태를 rejected로 변경한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const callback = vi.fn();
      socket._trigger("request:change-status", { requestId: created.id, status: "rejected" }, callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:status-changed",
        expect.objectContaining({ status: "rejected", rejectedAt: expect.any(Number) }),
      );
    });

    it("resolved로 변경 시 기존 commitHash를 보존한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // update로 commitHash 설정
      const updateCallback = vi.fn();
      socket._trigger("request:update", { requestId: created.id, commitHash: "abc1234" }, updateCallback);
      await vi.waitFor(() => expect(updateCallback).toHaveBeenCalledWith({ success: true }));

      // resolved로 변경
      const callback = vi.fn();
      socket._trigger("request:change-status", { requestId: created.id, status: "resolved" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:status-changed",
        expect.objectContaining({ status: "resolved", commitHash: "abc1234" }),
      );
    });

    it("비 resolved로 변경 시 commitHash를 클리어한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // resolved + commitHash 설정
      socket._trigger("request:change-status", { requestId: created.id, status: "resolved" }, vi.fn());
      await vi.waitFor(() => {});
      socket._trigger("request:update", { requestId: created.id, commitHash: "abc1234" }, vi.fn());
      await vi.waitFor(() => {});

      // open으로 변경
      const callback = vi.fn();
      socket._trigger("request:change-status", { requestId: created.id, status: "open" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:status-changed",
        expect.objectContaining({ status: "open", commitHash: null, commitUrl: null }),
      );
    });

    it("이미 같은 상태면 무시한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const callback = vi.fn();
      socket._trigger("request:change-status", { requestId: created.id, status: "open" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: true });
      });
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      normalSocket._trigger("request:change-status", { requestId: "req-1", status: "rejected" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("미인증 사용자는 거부한다", () => {
      const unauthSocket = createMockSocket("socket-2", "Player2", { authenticated: false });
      setupRequestHandler(io as unknown as GameServer, unauthSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      unauthSocket._trigger("request:change-status", { requestId: "req-1", status: "rejected" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "인증이 필요합니다" });
    });

    it("없는 요청 ID는 에러를 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:change-status", { requestId: "nonexistent", status: "rejected" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
      });
    });
  });

  describe("request:update", () => {
    it("관리자가 제목을 수정한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "원래 제목", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const updateCallback = vi.fn();
      socket._trigger("request:update", { requestId: created.id, title: "수정된 제목" }, updateCallback);

      await vi.waitFor(() => {
        expect(updateCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:updated",
        expect.objectContaining({ title: "수정된 제목", description: "설명" }),
      );
    });

    it("관리자가 답변과 커밋해시를 수정한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const updateCallback = vi.fn();
      socket._trigger("request:update", { requestId: created.id, adminResponse: "답변", commitHash: "abc1234" }, updateCallback);

      await vi.waitFor(() => {
        expect(updateCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:updated",
        expect.objectContaining({ adminResponse: "답변", commitHash: "abc1234" }),
      );
    });

    it("adminResponse를 null로 설정하면 삭제된다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      // 먼저 답변 설정
      socket._trigger("request:update", { requestId: created.id, adminResponse: "답변" }, vi.fn());
      await vi.waitFor(() => {});

      // null로 삭제
      const updateCallback = vi.fn();
      socket._trigger("request:update", { requestId: created.id, adminResponse: null }, updateCallback);

      await vi.waitFor(() => {
        expect(updateCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:updated",
        expect.objectContaining({ adminResponse: null }),
      );
    });

    it("빈 제목은 거부한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const updateCallback = vi.fn();
      socket._trigger("request:update", { requestId: created.id, title: "" }, updateCallback);

      await vi.waitFor(() => {
        expect(updateCallback).toHaveBeenCalledWith({ success: false, error: "제목은 1~100자여야 합니다" });
      });
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      normalSocket._trigger("request:update", { requestId: "req-1", title: "새 제목" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("없는 요청 ID는 에러를 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:update", { requestId: "nonexistent", title: "새 제목" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
      });
    });
  });

  describe("request:change-label", () => {
    it("관리자가 라벨을 변경한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "기능 요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const changeLabelCallback = vi.fn();
      socket._trigger("request:change-label", { requestId: created.id, label: "bug" }, changeLabelCallback);

      await vi.waitFor(() => {
        expect(changeLabelCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:label-changed",
        expect.objectContaining({
          id: created.id,
          label: "bug",
        }),
      );
    });

    it("모든 상태에서 라벨 변경이 가능하다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      // 요청 생성 후 resolved 상태로 변경
      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "완료된 요청", description: "설명", label: "feature" }, createCallback);
      await vi.waitFor(() => expect(createCallback).toHaveBeenCalled());
      const created = createCallback.mock.calls[0][0] as FeatureRequest;

      const resolveCallback = vi.fn();
      socket._trigger("request:change-status", { requestId: created.id, status: "resolved" }, resolveCallback);
      await vi.waitFor(() => expect(resolveCallback).toHaveBeenCalledWith({ success: true }));

      // resolved 상태에서 라벨 변경
      const changeLabelCallback = vi.fn();
      socket._trigger("request:change-label", { requestId: created.id, label: "improvement" }, changeLabelCallback);

      await vi.waitFor(() => {
        expect(changeLabelCallback).toHaveBeenCalledWith({ success: true });
      });
      expect((io as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith(
        "request:label-changed",
        expect.objectContaining({
          id: created.id,
          label: "improvement",
          status: "resolved",
        }),
      );
    });

    it("비관리자는 거부한다", () => {
      const normalSocket = createMockSocket("socket-2", "NormalUser");
      setupRequestHandler(io as unknown as GameServer, normalSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      normalSocket._trigger("request:change-label", { requestId: "req-1", label: "bug" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "권한이 없습니다" });
    });

    it("미인증 사용자는 거부한다", () => {
      const unauthSocket = createMockSocket("socket-2", "Player2", { authenticated: false });
      setupRequestHandler(io as unknown as GameServer, unauthSocket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      unauthSocket._trigger("request:change-label", { requestId: "req-1", label: "bug" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "인증이 필요합니다" });
    });

    it("유효하지 않은 라벨은 거부한다", () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:change-label", { requestId: "req-1", label: "invalid" }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: "유효하지 않은 라벨입니다" });
    });

    it("없는 요청 ID는 에러를 반환한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);
      const callback = vi.fn();
      socket._trigger("request:change-label", { requestId: "nonexistent", label: "bug" }, callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith({ success: false, error: "요청사항을 찾을 수 없습니다" });
      });
    });
  });

  describe("request:delete", () => {
    it("관리자가 요청을 삭제한다", async () => {
      setupRequestHandler(io as unknown as GameServer, socket as unknown as GameSocket, requestStore);

      // 먼저 요청 생성
      const createCallback = vi.fn();
      socket._trigger("request:create", { title: "삭제 대상", description: "설명", label: "feature" }, createCallback);

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
