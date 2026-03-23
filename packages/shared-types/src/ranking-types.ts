import type { MinesweeperDifficulty, TetrisDifficulty } from "./game-types";

export type RankingGameType = "minesweeper" | "tetris";
export type RankingDifficulty = MinesweeperDifficulty | TetrisDifficulty;
export type RankingKey = `${RankingGameType}:${RankingDifficulty}`;

export interface RankingEntry {
  id: string;
  nickname: string;
  score: number; // minesweeper: completion time in ms (lower=better), tetris: score (higher=better)
  date: number;
}
