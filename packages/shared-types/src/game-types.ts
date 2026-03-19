import type { Player } from "./player-types";

export type GameType = "gomoku" | "texas-holdem" | "minesweeper";

export interface GameConfig {
  gameType: GameType;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  icon: string;
}

export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  gomoku: {
    gameType: "gomoku",
    name: "오목",
    description: "15×15 보드에서 5개를 연속으로 놓으면 승리",
    minPlayers: 2,
    maxPlayers: 2,
    icon: "⚫",
  },
  "texas-holdem": {
    gameType: "texas-holdem",
    name: "텍사스 홀덤",
    description: "포커 카드 게임, 베팅으로 승부",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "🃏",
  },
  minesweeper: {
    gameType: "minesweeper",
    name: "지뢰찾기",
    description: "초급/중급/고급 난이도로 지뢰를 피해 모든 안전한 칸을 열면 승리",
    minPlayers: 1,
    maxPlayers: 1,
    icon: "💣",
  },
};

export type StoneColor = "black" | "white";

export interface GomokuState {
  board: (StoneColor | null)[][];
  currentTurn: StoneColor;
  players: Record<StoneColor, string>; // playerId
  lastMove: { row: number; col: number } | null;
  moveCount: number;
}

export interface GomokuMove {
  row: number;
  col: number;
}

// Texas Hold'em types
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type HoldemPhase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
export type HoldemAction = "fold" | "check" | "call" | "raise" | "all-in";

export interface HoldemPlayerState {
  id: string;
  nickname: string;
  chips: number;
  currentBet: number;
  holeCards: Card[];
  folded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isTurn: boolean;
  seatIndex: number;
}

export interface HoldemPublicState {
  phase: HoldemPhase;
  communityCards: Card[];
  pot: number;
  currentBet: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  players: Omit<HoldemPlayerState, "holeCards">[];
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  winners?: { playerId: string; amount: number; handName: string }[];
}

export interface HoldemPrivateState {
  holeCards: Card[];
}

export interface HoldemMove {
  action: HoldemAction;
  amount?: number;
}

// Minesweeper types
export type MinesweeperDifficulty = "beginner" | "intermediate" | "expert";

export interface MinesweeperDifficultyConfig {
  rows: number;
  cols: number;
  mineCount: number;
  label: string;
}

export const MINESWEEPER_DIFFICULTY_CONFIGS: Record<MinesweeperDifficulty, MinesweeperDifficultyConfig> = {
  beginner: { rows: 9, cols: 9, mineCount: 10, label: "초급" },
  intermediate: { rows: 16, cols: 16, mineCount: 40, label: "중급" },
  expert: { rows: 16, cols: 30, mineCount: 99, label: "고급" },
};

export type MinesweeperCellStatus = "hidden" | "revealed" | "flagged";

export interface MinesweeperPublicCell {
  status: MinesweeperCellStatus;
  adjacentMines?: number;
  hasMine?: boolean;
}

export interface MinesweeperPublicState {
  board: MinesweeperPublicCell[][];
  rows: number;
  cols: number;
  mineCount: number;
  flagCount: number;
  revealedCount: number;
  difficulty: MinesweeperDifficulty;
  status: "playing" | "won" | "lost";
  playerId: string;
  startedAt: number | null;
}

export interface MinesweeperMove {
  type: "reveal" | "flag" | "unflag";
  row: number;
  col: number;
}

export type GameState = GomokuState | HoldemPublicState | MinesweeperPublicState;
export type GameMove = GomokuMove | HoldemMove | MinesweeperMove;

export interface GameResult {
  winnerId: string | null; // null = draw
  reason: string;
}
