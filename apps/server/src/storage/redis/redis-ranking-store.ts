import type Redis from "ioredis";
import type { RankingEntry, RankingKey } from "@game-hub/shared-types";
import type { RankingStore } from "../interfaces/ranking-store.js";

const MAX_ENTRIES = 10;

export class RedisRankingStore implements RankingStore {
  constructor(private redis: Redis) {}

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
}
