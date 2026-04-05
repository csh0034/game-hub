import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisPlacardStore } from "./redis-placard-store.js";

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
}

describe("RedisPlacardStore", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let store: RedisPlacardStore;

  beforeEach(() => {
    redis = createMockRedis();
    store = new RedisPlacardStore(redis as never);
  });

  describe("getItems", () => {
    it("저장된 아이템 목록을 반환한다", async () => {
      redis.get.mockResolvedValue(JSON.stringify(["hello", "world"]));
      const result = await store.getItems();
      expect(result).toEqual(["hello", "world"]);
      expect(redis.get).toHaveBeenCalledWith("placard:items");
    });

    it("아이템이 없으면 빈 배열을 반환한다", async () => {
      const result = await store.getItems();
      expect(result).toEqual([]);
    });

    it("구 형식(placard:text)에서 마이그레이션한다", async () => {
      redis.get
        .mockResolvedValueOnce(null) // placard:items
        .mockResolvedValueOnce("old text"); // placard:text
      const result = await store.getItems();
      expect(result).toEqual(["old text"]);
      expect(redis.set).toHaveBeenCalledWith("placard:items", JSON.stringify(["old text"]));
      expect(redis.del).toHaveBeenCalledWith("placard:text");
    });

    it("Redis 에러 시 빈 배열을 반환한다", async () => {
      redis.get.mockRejectedValue(new Error("fail"));
      const result = await store.getItems();
      expect(result).toEqual([]);
    });
  });

  describe("setItems", () => {
    it("아이템 목록을 저장한다", async () => {
      await store.setItems(["a", "b"]);
      expect(redis.set).toHaveBeenCalledWith("placard:items", JSON.stringify(["a", "b"]));
    });

    it("빈 배열이면 키를 삭제한다", async () => {
      await store.setItems([]);
      expect(redis.del).toHaveBeenCalledWith("placard:items");
    });

    it("Redis 에러 시 예외를 던지지 않는다", async () => {
      redis.set.mockRejectedValue(new Error("fail"));
      await expect(store.setItems(["a"])).resolves.toBeUndefined();
    });
  });
});
