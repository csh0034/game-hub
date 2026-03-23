import type { RankingEntry, RankingKey } from "@game-hub/shared-types";

export interface RankingStore {
  getRankings(key: RankingKey): Promise<RankingEntry[]>;
  addEntry(key: RankingKey, entry: RankingEntry, sortAsc: boolean): Promise<{ rank: number | null; entries: RankingEntry[] }>;
}
