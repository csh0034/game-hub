import type { RankingEntry, RankingKey } from "@game-hub/shared-types";
import type { RankingStore } from "../interfaces/ranking-store.js";

const MAX_ENTRIES = 10;

export class InMemoryRankingStore implements RankingStore {
  private rankings = new Map<RankingKey, RankingEntry[]>();

  async getRankings(key: RankingKey): Promise<RankingEntry[]> {
    return this.rankings.get(key) ?? [];
  }

  async addEntry(
    key: RankingKey,
    entry: RankingEntry,
    sortAsc: boolean,
  ): Promise<{ rank: number | null; entries: RankingEntry[] }> {
    const existing = this.rankings.get(key) ?? [];
    const entries = [...existing, entry];
    entries.sort((a, b) => (sortAsc ? a.score - b.score : b.score - a.score));
    const trimmed = entries.slice(0, MAX_ENTRIES);
    const rank = trimmed.findIndex((e) => e.id === entry.id);

    this.rankings.set(key, trimmed);

    return {
      rank: rank >= 0 ? rank + 1 : null,
      entries: trimmed,
    };
  }

  async deleteEntry(key: RankingKey, entryId: string): Promise<RankingEntry[]> {
    const existing = this.rankings.get(key) ?? [];
    const filtered = existing.filter((e) => e.id !== entryId);
    this.rankings.set(key, filtered);
    return filtered;
  }
}
