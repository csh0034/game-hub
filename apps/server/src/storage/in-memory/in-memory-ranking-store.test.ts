import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRankingStore } from "./in-memory-ranking-store.js";
import type { RankingEntry, RankingKey } from "@game-hub/shared-types";

function createEntry(id: string, nickname: string, score: number, date = Date.now()): RankingEntry {
  return { id, nickname, score, date };
}

describe("InMemoryRankingStore", () => {
  let store: InMemoryRankingStore;

  beforeEach(() => {
    store = new InMemoryRankingStore();
  });

  describe("getRankings", () => {
    it("존재하지 않는 키에 대해 빈 배열을 반환한다", async () => {
      const result = await store.getRankings("minesweeper:beginner");
      expect(result).toEqual([]);
    });
  });

  describe("addEntry (오름차순 - 지뢰찾기)", () => {
    const key: RankingKey = "minesweeper:beginner";

    it("엔트리를 추가하고 rank 1을 반환한다", async () => {
      const entry = createEntry("1", "Alice", 5000);
      const result = await store.addEntry(key, entry, true);

      expect(result.rank).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].nickname).toBe("Alice");
    });

    it("낮은 점수가 더 높은 순위로 정렬된다", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 10000), true);
      const result = await store.addEntry(key, createEntry("2", "Bob", 5000), true);

      expect(result.rank).toBe(1);
      expect(result.entries[0].nickname).toBe("Bob");
      expect(result.entries[1].nickname).toBe("Alice");
    });

    it("10개를 초과하면 하위 엔트리가 제거된다", async () => {
      for (let i = 0; i < 10; i++) {
        await store.addEntry(key, createEntry(`${i}`, `Player${i}`, (i + 1) * 1000), true);
      }

      const result = await store.addEntry(key, createEntry("11", "Slow", 99999), true);
      expect(result.rank).toBeNull();
      expect(result.entries).toHaveLength(10);
    });

    it("10개를 초과해도 신기록이면 rank 1을 반환한다", async () => {
      for (let i = 0; i < 10; i++) {
        await store.addEntry(key, createEntry(`${i}`, `Player${i}`, (i + 1) * 1000), true);
      }

      const result = await store.addEntry(key, createEntry("new", "Fast", 500), true);
      expect(result.rank).toBe(1);
      expect(result.entries[0].nickname).toBe("Fast");
      expect(result.entries).toHaveLength(10);
    });

    it("isNewRecord는 rank가 1일 때만 true이다", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 5000), true);
      const result = await store.addEntry(key, createEntry("2", "Bob", 10000), true);
      expect(result.rank).toBe(2);
    });
  });

  describe("addEntry - 닉네임 중복 방지", () => {
    const key: RankingKey = "minesweeper:beginner";

    it("같은 닉네임의 더 좋은 기록으로 갱신한다 (오름차순)", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 10000), true);
      const result = await store.addEntry(key, createEntry("2", "Alice", 5000), true);

      expect(result.rank).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].score).toBe(5000);
    });

    it("같은 닉네임의 더 나쁜 기록은 무시한다 (오름차순)", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 5000), true);
      const result = await store.addEntry(key, createEntry("2", "Alice", 10000), true);

      expect(result.rank).toBeNull();
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].score).toBe(5000);
    });

    it("같은 닉네임의 동일 점수는 무시한다", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 5000), true);
      const result = await store.addEntry(key, createEntry("2", "Alice", 5000), true);

      expect(result.rank).toBeNull();
      expect(result.entries).toHaveLength(1);
    });

    it("기존 중복 닉네임 데이터를 자동 정리한다 (더 나쁜 기록 제출 시)", async () => {
      // 중복 방지 이전에 쌓인 기존 중복 데이터 시뮬레이션
      await store.addEntry(key, createEntry("1", "Alice", 5000), true);
      // 내부 배열에 직접 중복 삽입 (레거시 데이터 시뮬레이션)
      const rankings = await store.getRankings(key);
      rankings.push(createEntry("dup", "Alice", 8000));

      const result = await store.addEntry(key, createEntry("3", "Alice", 9000), true);

      expect(result.rank).toBeNull();
      expect(result.entries.filter((e) => e.nickname === "Alice")).toHaveLength(1);
      expect(result.entries.find((e) => e.nickname === "Alice")!.score).toBe(5000);
    });

    it("기존 중복 닉네임 데이터를 자동 정리한다 (더 좋은 기록 제출 시)", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 10000), true);
      const rankings = await store.getRankings(key);
      rankings.push(createEntry("dup", "Alice", 8000));

      const result = await store.addEntry(key, createEntry("3", "Alice", 3000), true);

      expect(result.rank).toBe(1);
      expect(result.entries.filter((e) => e.nickname === "Alice")).toHaveLength(1);
      expect(result.entries.find((e) => e.nickname === "Alice")!.score).toBe(3000);
    });

    it("다른 닉네임은 별도로 저장된다", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 5000), true);
      const result = await store.addEntry(key, createEntry("2", "Bob", 3000), true);

      expect(result.rank).toBe(1);
      expect(result.entries).toHaveLength(2);
    });
  });

  describe("addEntry (내림차순 - 테트리스)", () => {
    const key: RankingKey = "tetris:intermediate";

    it("높은 점수가 더 높은 순위로 정렬된다", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 1000), false);
      const result = await store.addEntry(key, createEntry("2", "Bob", 5000), false);

      expect(result.rank).toBe(1);
      expect(result.entries[0].nickname).toBe("Bob");
      expect(result.entries[1].nickname).toBe("Alice");
    });

    it("낮은 점수는 Top 10 밖이면 null을 반환한다", async () => {
      for (let i = 0; i < 10; i++) {
        await store.addEntry(key, createEntry(`${i}`, `Player${i}`, (i + 1) * 10000), false);
      }

      const result = await store.addEntry(key, createEntry("low", "Low", 100), false);
      expect(result.rank).toBeNull();
      expect(result.entries).toHaveLength(10);
    });
  });

  describe("deleteEntry", () => {
    const key: RankingKey = "minesweeper:beginner";

    it("엔트리를 삭제한다", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 5000), true);
      await store.addEntry(key, createEntry("2", "Bob", 3000), true);

      const result = await store.deleteEntry(key, "1");
      expect(result).toHaveLength(1);
      expect(result[0].nickname).toBe("Bob");
    });

    it("존재하지 않는 엔트리 삭제 시 기존 목록을 반환한다", async () => {
      await store.addEntry(key, createEntry("1", "Alice", 5000), true);

      const result = await store.deleteEntry(key, "nonexistent");
      expect(result).toHaveLength(1);
    });

    it("빈 키에서 삭제 시 빈 배열을 반환한다", async () => {
      const result = await store.deleteEntry(key, "1");
      expect(result).toEqual([]);
    });
  });

  describe("난이도별 분리", () => {
    it("같은 게임이라도 난이도가 다르면 별도 랭킹이다", async () => {
      await store.addEntry("minesweeper:beginner", createEntry("1", "A", 5000), true);
      await store.addEntry("minesweeper:expert", createEntry("2", "B", 3000), true);

      const beginner = await store.getRankings("minesweeper:beginner");
      const expert = await store.getRankings("minesweeper:expert");

      expect(beginner).toHaveLength(1);
      expect(expert).toHaveLength(1);
      expect(beginner[0].nickname).toBe("A");
      expect(expert[0].nickname).toBe("B");
    });
  });
});
