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

      // 같은 닉네임의 기존 기록 확인 — 더 좋은 기록일 때만 교체
      const prevEntries = existing.filter((e) => e.nickname === entry.nickname);
      if (prevEntries.length > 0) {
        const best = prevEntries.reduce((a, b) =>
          (sortAsc ? a.score <= b.score : a.score >= b.score) ? a : b,
        );
        const isWorse = sortAsc ? entry.score >= best.score : entry.score <= best.score;
        if (isWorse) {
          // 기존 중복 정리 후 최고 기록만 유지
          const cleaned = existing.filter((e) => e.nickname !== entry.nickname);
          cleaned.push(best);
          cleaned.sort((a, b) => (sortAsc ? a.score - b.score : b.score - a.score));
          const trimmed = cleaned.slice(0, MAX_ENTRIES);
          if (cleaned.length !== existing.length) {
            await this.redis.set(`ranking:${key}`, JSON.stringify(trimmed));
          }
          return { rank: null, entries: trimmed };
        }
        // 기존 기록 모두 제거 (새 기록으로 교체)
        const cleaned = existing.filter((e) => e.nickname !== entry.nickname);
        existing.length = 0;
        existing.push(...cleaned);
      }

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
