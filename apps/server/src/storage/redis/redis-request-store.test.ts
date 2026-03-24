import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisRequestStore } from "./redis-request-store.js";
import type { FeatureRequest } from "@game-hub/shared-types";

function createMockRedis() {
  return {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    sadd: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    srem: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  };
}

const request: FeatureRequest = {
  id: "req-1",
  title: "테스트 요청",
  description: "테스트 설명",
  label: "feature",
  author: "Player1",
  status: "open",
  createdAt: 1000,
  inProgressAt: null,
  rejectedAt: null,
  resolvedAt: null,
  stoppedAt: null,
  adminResponse: null,
  commitHash: null,
  commitUrl: null,
};

describe("RedisRequestStore", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let store: RedisRequestStore;

  beforeEach(() => {
    redis = createMockRedis();
    store = new RedisRequestStore(redis as never);
  });

  describe("createRequest", () => {
    it("요청을 Redis에 저장하고 SET에 ID를 추가한다", async () => {
      const pipeline = {
        set: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline as never);

      await store.createRequest(request);

      expect(pipeline.set).toHaveBeenCalledWith(
        `request:${request.id}`,
        JSON.stringify(request),
      );
      expect(pipeline.sadd).toHaveBeenCalledWith("requests", request.id);
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });

  describe("getRequest", () => {
    it("요청을 반환한다", async () => {
      redis.get.mockResolvedValue(JSON.stringify(request));
      const result = await store.getRequest("req-1");
      expect(result).toEqual(request);
      expect(redis.get).toHaveBeenCalledWith("request:req-1");
    });

    it("새 필드가 없는 기존 데이터를 정규화한다", async () => {
      const legacyRequest = {
        id: "req-1",
        title: "테스트 요청",
        description: "테스트 설명",
        author: "Player1",
        status: "open",
        createdAt: 1000,
        resolvedAt: null,
        commitHash: null,
        commitUrl: null,
      };
      redis.get.mockResolvedValue(JSON.stringify(legacyRequest));
      const result = await store.getRequest("req-1");
      expect(result).toEqual({
        ...legacyRequest,
        label: "feature",
        inProgressAt: null,
        rejectedAt: null,
        adminResponse: null,
      });
    });

    it("없는 ID에 null을 반환한다", async () => {
      redis.get.mockResolvedValue(null);
      const result = await store.getRequest("nonexistent");
      expect(result).toBeNull();
    });

    it("Redis 에러 시 null을 반환한다", async () => {
      redis.get.mockRejectedValue(new Error("fail"));
      const result = await store.getRequest("req-1");
      expect(result).toBeNull();
    });
  });

  describe("getAllRequests", () => {
    it("모든 요청을 createdAt 내림차순으로 반환한다", async () => {
      const req2: FeatureRequest = { ...request, id: "req-2", createdAt: 2000 };
      redis.smembers.mockResolvedValue(["req-1", "req-2"]);

      const pipeline = {
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, JSON.stringify(request)],
          [null, JSON.stringify(req2)],
        ]),
      };
      redis.pipeline.mockReturnValue(pipeline as never);

      const result = await store.getAllRequests();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("req-2");
      expect(result[1].id).toBe("req-1");
    });

    it("ID 목록이 비어있으면 빈 배열을 반환한다", async () => {
      redis.smembers.mockResolvedValue([]);
      const result = await store.getAllRequests();
      expect(result).toEqual([]);
    });

    it("Redis 에러 시 빈 배열을 반환한다", async () => {
      redis.smembers.mockRejectedValue(new Error("fail"));
      const result = await store.getAllRequests();
      expect(result).toEqual([]);
    });
  });

  describe("updateRequest", () => {
    it("요청을 업데이트한다", async () => {
      const updated = { ...request, status: "resolved" as const };
      await store.updateRequest(updated);
      expect(redis.set).toHaveBeenCalledWith(
        `request:${updated.id}`,
        JSON.stringify(updated),
      );
    });
  });

  describe("deleteRequest", () => {
    it("요청을 삭제한다", async () => {
      const pipeline = {
        del: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline as never);

      await store.deleteRequest("req-1");

      expect(pipeline.del).toHaveBeenCalledWith("request:req-1");
      expect(pipeline.srem).toHaveBeenCalledWith("requests", "req-1");
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });
});
