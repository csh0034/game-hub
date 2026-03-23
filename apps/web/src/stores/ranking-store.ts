import { create } from "zustand";
import type { RankingEntry } from "@game-hub/shared-types";

interface RankingStore {
  rankings: Record<string, RankingEntry[]>;
  setRankings: (key: string, entries: RankingEntry[]) => void;
  reset: () => void;
}

export const useRankingStore = create<RankingStore>((set) => ({
  rankings: {},
  setRankings: (key, entries) =>
    set((state) => ({ rankings: { ...state.rankings, [key]: entries } })),
  reset: () => set({ rankings: {} }),
}));
