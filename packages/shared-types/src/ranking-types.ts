import type { MinesweeperDifficulty, TetrisDifficulty } from "./game-types";

export type RankingGameType = "minesweeper" | "tetris-classic" | "tetris";
export type RankingDifficulty = MinesweeperDifficulty | TetrisDifficulty;
export type RankingKey = `${RankingGameType}:${RankingDifficulty}`;

export interface RankingEntry {
  id: string;
  nickname: string;
  score: number; // minesweeper/tetris: completion time in ms (lower=better), tetris-classic: score points (higher=better)
  date: number;
}
