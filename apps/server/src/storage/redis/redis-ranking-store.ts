import type Redis from "ioredis";
import type { RankingEntry, RankingKey } from "@game-hub/shared-types";
import type { RankingStore } from "../interfaces/ranking-store.js";

const MAX_ENTRIES = 10;

export class RedisRankingStore implements RankingStore {
  constructor(private redis: Redis) {}

  /**
   * 테트리스 랭킹 키를 easy/normal/hard → beginner/intermediate/expert로 마이그레이션.
   * old key가 존재하고 new key가 없으면 rename, 둘 다 있으면 old key 삭제.
   */
  async migrateTetrisKeys(): Promise<void> {
    const migrations: [string, string][] = [
      ["ranking:tetris:easy", "ranking:tetris:beginner"],
      ["ranking:tetris:normal", "ranking:tetris:intermediate"],
      ["ranking:tetris:hard", "ranking:tetris:expert"],
    ];

    for (const [oldKey, newKey] of migrations) {
      try {
        const oldExists = await this.redis.exists(oldKey);
        if (!oldExists) continue;

        const newExists = await this.redis.exists(newKey);
        if (newExists) {
          await this.redis.del(oldKey);
          console.log(`[ranking-migration] deleted old key ${oldKey} (new key already exists)`);
        } else {
          await this.redis.rename(oldKey, newKey);
          console.log(`[ranking-migration] renamed ${oldKey} → ${newKey}`);
        }
      } catch (err) {
        console.error(`[ranking-migration] failed to migrate ${oldKey}:`, err);
      }
    }
  }

  async getRankings(key: RankingKey): Promise<RankingEntry[]> {
    try {
      const data = await this.redis.get(`ranking:${key}`);
      return data ? (JSON.parse(data) as RankingEntry[]) : [];
    } catch (err) {
      console.error("[ranking-store] failed to get rankings:", err);
      return [];
    }
  }

  async addEntry(
    key: RankingKey,
    entry: RankingEntry,
    sortAsc: boolean,
  ): Promise<{ rank: number | null; entries: RankingEntry[] }> {
    try {
      const existing = await this.getRankings(key);
      const entries = [...existing, entry];
      entries.sort((a, b) => (sortAsc ? a.score - b.score : b.score - a.score));
      const trimmed = entries.slice(0, MAX_ENTRIES);
      const rank = trimmed.findIndex((e) => e.id === entry.id);

      await this.redis.set(`ranking:${key}`, JSON.stringify(trimmed));

      return {
        rank: rank >= 0 ? rank + 1 : null,
        entries: trimmed,
      };
    } catch (err) {
      console.error("[ranking-store] failed to add entry:", err);
      return { rank: null, entries: [] };
    }
  }

  async deleteEntry(key: RankingKey, entryId: string): Promise<RankingEntry[]> {
    try {
      const existing = await this.getRankings(key);
      const filtered = existing.filter((e) => e.id !== entryId);
      await this.redis.set(`ranking:${key}`, JSON.stringify(filtered));
      return filtered;
    } catch (err) {
      console.error("[ranking-store] failed to delete entry:", err);
      return [];
    }
  }
}
