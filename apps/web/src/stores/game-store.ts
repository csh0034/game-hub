import { create } from "zustand";
import type { GameState, GameResult, HoldemPrivateState } from "@game-hub/shared-types";

interface PlayerLeftInfo {
  nickname: string;
  willEnd: boolean;
}

interface GameStore {
  gameState: GameState | null;
  gameResult: GameResult | null;
  privateState: HoldemPrivateState | null;
  playerLeftInfo: PlayerLeftInfo | null;
  setGameState: (state: GameState) => void;
  setGameResult: (result: GameResult | null) => void;
  setPrivateState: (state: HoldemPrivateState) => void;
  setPlayerLeftInfo: (info: PlayerLeftInfo | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  gameResult: null,
  privateState: null,
  playerLeftInfo: null,
  setGameState: (gameState) => set({ gameState }),
  setGameResult: (gameResult) => set({ gameResult }),
  setPrivateState: (privateState) => set({ privateState }),
  setPlayerLeftInfo: (playerLeftInfo) => set({ playerLeftInfo }),
  reset: () => set({ gameState: null, gameResult: null, privateState: null, playerLeftInfo: null }),
}));
