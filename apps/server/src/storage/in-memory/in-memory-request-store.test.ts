import { describe, it, expect, beforeEach } from "vitest";
import type { FeatureRequest } from "@game-hub/shared-types";
import { InMemoryRequestStore } from "./in-memory-request-store.js";

function createRequest(id: string, createdAt: number): FeatureRequest {
  return {
    id,
    title: `요청-${id}`,
    description: `설명-${id}`,
    author: "Player1",
    status: "open",
    createdAt,
    inProgressAt: null,
    rejectedAt: null,
    resolvedAt: null,
    adminResponse: null,
    commitHash: null,
    commitUrl: null,
  };
}

describe("InMemoryRequestStore", () => {
  let store: InMemoryRequestStore;

  beforeEach(() => {
    store = new InMemoryRequestStore();
  });

  describe("createRequest / getRequest", () => {
    it("요청을 생성하고 조회한다", async () => {
      const req = createRequest("req-1", 1000);
      await store.createRequest(req);

      expect(await store.getRequest("req-1")).toEqual(req);
    });

    it("존재하지 않는 요청은 null을 반환한다", async () => {
      expect(await store.getRequest("unknown")).toBeNull();
    });
  });

  describe("getAllRequests", () => {
    it("모든 요청을 createdAt 내림차순으로 반환한다", async () => {
      await store.createRequest(createRequest("req-1", 1000));
      await store.createRequest(createRequest("req-2", 3000));
      await store.createRequest(createRequest("req-3", 2000));

      const requests = await store.getAllRequests();
      expect(requests).toHaveLength(3);
      expect(requests[0].id).toBe("req-2");
      expect(requests[1].id).toBe("req-3");
      expect(requests[2].id).toBe("req-1");
    });

    it("빈 상태에서 빈 배열을 반환한다", async () => {
      expect(await store.getAllRequests()).toEqual([]);
    });
  });

  describe("updateRequest", () => {
    it("요청을 업데이트한다", async () => {
      const req = createRequest("req-1", 1000);
      await store.createRequest(req);

      const updated = { ...req, status: "resolved" as const, resolvedAt: 2000 };
      await store.updateRequest(updated);

      expect(await store.getRequest("req-1")).toEqual(updated);
    });
  });

  describe("deleteRequest", () => {
    it("요청을 삭제한다", async () => {
      await store.createRequest(createRequest("req-1", 1000));
      await store.deleteRequest("req-1");

      expect(await store.getRequest("req-1")).toBeNull();
    });

    it("존재하지 않는 요청 삭제 시 에러가 발생하지 않는다", async () => {
      await expect(store.deleteRequest("unknown")).resolves.toBeUndefined();
    });
  });
});
