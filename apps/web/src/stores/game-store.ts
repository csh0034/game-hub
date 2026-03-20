import { create } from "zustand";
import type { GameState, GameResult, HoldemPrivateState, Card } from "@game-hub/shared-types";

interface PlayerLeftInfo {
  nickname: string;
  willEnd: boolean;
}

export interface RoundResult {
  winners: { playerId: string; amount: number; handName: string }[];
  showdownCards?: Record<string, Card[]>;
  eliminatedPlayerIds: string[];
  nextRoundIn: number;
}

interface GameStore {
  gameState: GameState | null;
  gameResult: GameResult | null;
  privateState: HoldemPrivateState | null;
  playerLeftInfo: PlayerLeftInfo | null;
  roundResult: RoundResult | null;
  setGameState: (state: GameState) => void;
  setGameResult: (result: GameResult | null) => void;
  setPrivateState: (state: HoldemPrivateState) => void;
  setPlayerLeftInfo: (info: PlayerLeftInfo | null) => void;
  setRoundResult: (result: RoundResult | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  gameResult: null,
  privateState: null,
  playerLeftInfo: null,
  roundResult: null,
  setGameState: (gameState) => set({ gameState }),
  setGameResult: (gameResult) => set({ gameResult }),
  setPrivateState: (privateState) => set({ privateState }),
  setPlayerLeftInfo: (playerLeftInfo) => set({ playerLeftInfo }),
  setRoundResult: (roundResult) => set({ roundResult }),
  reset: () => set({ gameState: null, gameResult: null, privateState: null, playerLeftInfo: null, roundResult: null }),
}));
