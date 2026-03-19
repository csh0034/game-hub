import { create } from "zustand";
import type { GameState, GameResult, HoldemPrivateState } from "@game-hub/shared-types";

interface GameStore {
  gameState: GameState | null;
  gameResult: GameResult | null;
  privateState: HoldemPrivateState | null;
  setGameState: (state: GameState) => void;
  setGameResult: (result: GameResult | null) => void;
  setPrivateState: (state: HoldemPrivateState) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  gameResult: null,
  privateState: null,
  setGameState: (gameState) => set({ gameState }),
  setGameResult: (gameResult) => set({ gameResult }),
  setPrivateState: (privateState) => set({ privateState }),
  reset: () => set({ gameState: null, gameResult: null, privateState: null }),
}));
