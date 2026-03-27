import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisRankingStore } from "./redis-ranking-store.js";
import type { RankingEntry, RankingKey } from "@game-hub/shared-types";

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  };
}

function createEntry(id: string, score: number, nickname = `Player-${id}`): RankingEntry {
  return { id, nickname, score, date: Date.now() };
}

const key: RankingKey = "minesweeper:beginner";

describe("RedisRankingStore", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let store: RedisRankingStore;

  beforeEach(() => {
    redis = createMockRedis();
    store = new RedisRankingStore(redis as never);
  });

  describe("getRankings", () => {
    it("저장된 엔트리를 파싱하여 반환한다", async () => {
      const entries = [createEntry("e1", 100), createEntry("e2", 200)];
      redis.get.mockResolvedValue(JSON.stringify(entries));

      const result = await store.getRankings(key);

      expect(result).toEqual(entries);
      expect(redis.get).toHaveBeenCalledWith(`ranking:${key}`);
    });

    it("데이터가 없으면 빈 배열을 반환한다", async () => {
      redis.get.mockResolvedValue(null);

      const result = await store.getRankings(key);

      expect(result).toEqual([]);
    });

    it("Redis 에러 시 빈 배열을 반환한다", async () => {
      redis.get.mockRejectedValue(new Error("fail"));

      const result = await store.getRankings(key);

      expect(result).toEqual([]);
    });
  });

  describe("addEntry", () => {
    it("오름차순으로 정렬하여 저장한다", async () => {
      const existing = [createEntry("e1", 200)];
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e2", 100);
      const result = await store.addEntry(key, newEntry, true);

      expect(result.entries[0].id).toBe("e2");
      expect(result.entries[1].id).toBe("e1");
      expect(redis.set).toHaveBeenCalledWith(
        `ranking:${key}`,
        JSON.stringify(result.entries),
      );
    });

    it("내림차순으로 정렬하여 저장한다", async () => {
      const existing = [createEntry("e1", 200)];
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e2", 100);
      const result = await store.addEntry(key, newEntry, false);

      expect(result.entries[0].id).toBe("e1");
      expect(result.entries[1].id).toBe("e2");
    });

    it("최대 10개까지만 유지한다", async () => {
      const existing = Array.from({ length: 10 }, (_, i) =>
        createEntry(`e${i}`, (i + 1) * 10),
      );
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e-new", 5);
      const result = await store.addEntry(key, newEntry, true);

      expect(result.entries).toHaveLength(10);
      expect(result.entries[0].id).toBe("e-new");
    });

    it("추가된 엔트리의 순위를 반환한다", async () => {
      const existing = [createEntry("e1", 100), createEntry("e2", 300)];
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e3", 200);
      const result = await store.addEntry(key, newEntry, true);

      expect(result.rank).toBe(2);
    });

    it("상위 10개에 포함되지 않으면 rank가 null이다", async () => {
      const existing = Array.from({ length: 10 }, (_, i) =>
        createEntry(`e${i}`, (i + 1) * 10),
      );
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e-worst", 9999);
      const result = await store.addEntry(key, newEntry, true);

      expect(result.rank).toBeNull();
    });

    it("같은 닉네임의 더 좋은 기록으로 갱신한다", async () => {
      const existing = [createEntry("e1", 10000, "Alice")];
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e2", 5000, "Alice");
      const result = await store.addEntry(key, newEntry, true);

      expect(result.rank).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].score).toBe(5000);
    });

    it("같은 닉네임의 더 나쁜 기록은 무시한다", async () => {
      const existing = [createEntry("e1", 5000, "Alice")];
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e2", 10000, "Alice");
      const result = await store.addEntry(key, newEntry, true);

      expect(result.rank).toBeNull();
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].score).toBe(5000);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it("기존 중복 닉네임 데이터를 자동 정리한다 (더 나쁜 기록 제출 시)", async () => {
      const existing = [
        createEntry("e1", 5000, "Alice"),
        createEntry("e-dup", 8000, "Alice"),
        createEntry("e3", 3000, "Bob"),
      ];
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e4", 9000, "Alice");
      const result = await store.addEntry(key, newEntry, true);

      expect(result.rank).toBeNull();
      expect(result.entries.filter((e) => e.nickname === "Alice")).toHaveLength(1);
      expect(result.entries.find((e) => e.nickname === "Alice")!.score).toBe(5000);
      expect(redis.set).toHaveBeenCalled();
    });

    it("기존 중복 닉네임 데이터를 자동 정리한다 (더 좋은 기록 제출 시)", async () => {
      const existing = [
        createEntry("e1", 10000, "Alice"),
        createEntry("e-dup", 8000, "Alice"),
        createEntry("e3", 3000, "Bob"),
      ];
      redis.get.mockResolvedValue(JSON.stringify(existing));

      const newEntry = createEntry("e4", 2000, "Alice");
      const result = await store.addEntry(key, newEntry, true);

      expect(result.rank).toBe(1);
      expect(result.entries.filter((e) => e.nickname === "Alice")).toHaveLength(1);
      expect(result.entries.find((e) => e.nickname === "Alice")!.score).toBe(2000);
    });

    it("Redis 에러 시 rank null과 빈 배열을 반환한다", async () => {
      redis.set.mockRejectedValue(new Error("fail"));

      const newEntry = createEntry("e1", 100);
      const result = await store.addEntry(key, newEntry, true);

      expect(result).toEqual({ rank: null, entries: [] });
    });
  });

  describe("deleteEntry", () => {
    it("엔트리를 제거하고 저장한다", async () => {
      const entries = [createEntry("e1", 100), createEntry("e2", 200)];
      redis.get.mockResolvedValue(JSON.stringify(entries));

      const result = await store.deleteEntry(key, "e1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("e2");
      expect(redis.set).toHaveBeenCalledWith(
        `ranking:${key}`,
        JSON.stringify([entries[1]]),
      );
    });

    it("Redis 에러 시 빈 배열을 반환한다", async () => {
      redis.get.mockRejectedValue(new Error("fail"));

      const result = await store.deleteEntry(key, "e1");

      expect(result).toEqual([]);
    });
  });
});
