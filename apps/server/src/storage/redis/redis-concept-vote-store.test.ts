import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisConceptVoteStore } from "./redis-concept-vote-store.js";

function createMockRedis() {
  return {
    sismember: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
  };
}

describe("RedisConceptVoteStore", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let store: RedisConceptVoteStore;

  beforeEach(() => {
    redis = createMockRedis();
    store = new RedisConceptVoteStore(redis as never);
  });

  describe("toggle", () => {
    it("투표하지 않은 상태에서 투표를 추가한다", async () => {
      redis.sismember.mockResolvedValue(0);
      await store.toggle("1-retro-arcade.html", "browser-1");
      expect(redis.sadd).toHaveBeenCalledWith("concept-vote:1-retro-arcade.html", "browser-1");
      expect(redis.srem).not.toHaveBeenCalled();
    });

    it("이미 투표한 상태에서 투표를 취소한다", async () => {
      redis.sismember.mockResolvedValue(1);
      await store.toggle("1-retro-arcade.html", "browser-1");
      expect(redis.srem).toHaveBeenCalledWith("concept-vote:1-retro-arcade.html", "browser-1");
      expect(redis.sadd).not.toHaveBeenCalled();
    });

    it("toggle 후 getAll 결과를 반환한다", async () => {
      redis.smembers.mockResolvedValue(["browser-1"]);
      const result = await store.toggle("1-retro-arcade.html", "browser-1");
      expect(result).toHaveProperty("1-retro-arcade.html", ["browser-1"]);
    });

    it("toggle 에러 시에도 getAll을 반환한다", async () => {
      redis.sismember.mockRejectedValue(new Error("fail"));
      const result = await store.toggle("1-retro-arcade.html", "browser-1");
      expect(result).toBeDefined();
    });
  });

  describe("getAll", () => {
    it("투표가 있는 컨셉만 반환한다", async () => {
      redis.smembers
        .mockResolvedValueOnce(["browser-1", "browser-2"]) // 1-retro-arcade
        .mockResolvedValueOnce([]) // 2-kawaii-pastel
        .mockResolvedValueOnce([]) // 3-terminal-hacker
        .mockResolvedValueOnce(["browser-3"]) // 4-gradient-glass
        .mockResolvedValueOnce([]) // 5-neo-tokyo
        .mockResolvedValueOnce([]); // 6-clay-3d

      const result = await store.getAll();
      expect(result).toEqual({
        "1-retro-arcade.html": ["browser-1", "browser-2"],
        "4-gradient-glass.html": ["browser-3"],
      });
    });

    it("투표가 없으면 빈 객체를 반환한다", async () => {
      const result = await store.getAll();
      expect(result).toEqual({});
    });

    it("Redis 에러 시 빈 객체를 반환한다", async () => {
      redis.smembers.mockRejectedValue(new Error("fail"));
      const result = await store.getAll();
      expect(result).toEqual({});
    });
  });
});
