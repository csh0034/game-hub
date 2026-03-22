export type GameType = "gomoku" | "texas-holdem" | "minesweeper" | "tetris" | "liar-drawing" | "catch-mind";

export interface GameConfig {
  gameType: GameType;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  icon: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  "liar-drawing": {
    gameType: "liar-drawing",
    name: "라이어 드로잉",
    description: "라이어를 찾아라! 소셜 디덕션 그림 게임",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "🎨",
  },
  "catch-mind": {
    gameType: "catch-mind",
    name: "캐치마인드",
    description: "출제자가 그린 그림을 보고 정답을 맞추는 드로잉 퀴즈 게임",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "🖼️",
  },
  tetris: {
    gameType: "tetris",
    name: "테트리스",
    description: "떨어지는 블록을 쌓아 줄을 완성하는 퍼즐 게임",
    minPlayers: 1,
    maxPlayers: 8,
    icon: "🧱",
  },
  gomoku: {
    gameType: "gomoku",
    name: "오목",
    description: "15×15 보드에서 5개를 연속으로 놓으면 승리",
    minPlayers: 2,
    maxPlayers: 2,
    icon: "⚫",
  },
  minesweeper: {
    gameType: "minesweeper",
    name: "지뢰찾기",
    description: "초급/중급/고급 난이도로 지뢰를 피해 모든 안전한 칸을 열면 승리",
    minPlayers: 1,
    maxPlayers: 1,
    icon: "💣",
  },
  "texas-holdem": {
    gameType: "texas-holdem",
    name: "텍사스 홀덤",
    description: "포커 카드 게임, 베팅으로 승부",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "🃏",
    disabled: true,
    disabledReason: "패치중",
  },
};

export type StoneColor = "black" | "white";

export interface GomokuState {
  board: (StoneColor | null)[][];
  currentTurn: StoneColor;
  players: Record<StoneColor, string>; // playerId
  lastMove: { row: number; col: number } | null;
  moveCount: number;
  turnStartedAt: number;
  gameStartedAt: number;
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
  eliminated: boolean;
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
  actedPlayerIds: string[];
  winners?: { playerId: string; amount: number; handName: string }[];
  showdownCards?: Record<string, Card[]>;
  roundNumber: number;
  eliminatedPlayerIds: string[];
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

// Tetris types
export type TetrisDifficulty = "easy" | "normal" | "hard";

export interface TetrisDifficultyConfig {
  initialInterval: number;
  startLevel: number;
  label: string;
}

export const TETRIS_DIFFICULTY_CONFIGS: Record<TetrisDifficulty, TetrisDifficultyConfig> = {
  easy: { initialInterval: 1000, startLevel: 1, label: "Easy" },
  normal: { initialInterval: 800, startLevel: 1, label: "Normal" },
  hard: { initialInterval: 400, startLevel: 5, label: "Hard" },
};

export type TetrominoType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export interface TetrisActivePiece {
  type: TetrominoType;
  row: number;
  col: number;
  rotation: 0 | 1 | 2 | 3;
}

export type TetrisPlayerStatus = "playing" | "gameover";

export interface TetrisPlayerBoard {
  board: (TetrominoType | null)[][];
  activePiece: TetrisActivePiece | null;
  ghostRow: number;
  holdPiece: TetrominoType | null;
  canHold: boolean;
  nextPieces: TetrominoType[];
  score: number;
  level: number;
  linesCleared: number;
  status: TetrisPlayerStatus;
  pendingGarbage: number;
  combo: number;
  backToBack: boolean;
  lastClearType: string | null;
  version: number;
}

export type TetrisMode = "solo" | "versus";

export interface TetrisPublicState {
  players: Record<string, TetrisPlayerBoard>;
  difficulty: TetrisDifficulty;
  mode: TetrisMode;
  dropInterval: number;
}

export type TetrisMoveType =
  | "tick"
  | "move-left"
  | "move-right"
  | "rotate-cw"
  | "rotate-ccw"
  | "soft-drop"
  | "hard-drop"
  | "hold";

export interface TetrisMove {
  type: TetrisMoveType;
}

export interface TetrisPlayerUpdate {
  playerId: string;
  board: TetrisPlayerBoard;
}

export interface TetrisPieceUpdate {
  playerId: string;
  activePiece: TetrisActivePiece | null;
  ghostRow: number;
  version: number;
}

export interface ComingSoonGame {
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  icon: string;
}

export const COMING_SOON_GAMES: ComingSoonGame[] = [];

// Liar Drawing types
export type LiarDrawingPhase = "role-reveal" | "drawing" | "voting" | "liar-guess" | "round-result" | "final-result";
export type DrawTool = "pen" | "eraser";
export type PenColor = "black" | "red" | "blue" | "green" | "yellow" | "orange" | "purple" | "white";
export type PenThickness = 2 | 5 | 10;

export interface DrawPoint {
  x: number;
  y: number;
  tool: DrawTool;
  color: PenColor;
  thickness: PenThickness;
  isStart: boolean;
}

export interface LiarDrawingPlayerState {
  id: string;
  nickname: string;
  score: number;
  isDrawing: boolean;
  hasDrawn: boolean;
  votedFor: string | null;
}

export interface LiarDrawingPublicState {
  phase: LiarDrawingPhase;
  roundNumber: number;
  totalRounds: number;
  category: string;
  drawOrder: string[];
  currentDrawerIndex: number;
  drawTimeSeconds: number;
  turnStartedAt: number | null;
  players: LiarDrawingPlayerState[];
  canvases: Record<string, DrawPoint[]>;
  votes: Record<string, string>;
  votedPlayerIds: string[];
  accusedPlayerId: string | null;
  liarId: string | null;
  liarGuess: string | null;
  liarGuessCorrect: boolean | null;
  roundScores: Record<string, number>;
}

export interface LiarDrawingPrivateState {
  role: "citizen" | "liar";
  keyword: string | null;
}

export interface LiarDrawingMove {
  type: "draw" | "clear-canvas" | "vote" | "liar-guess" | "phase-ready" | "complete-turn";
  points?: DrawPoint[];
  targetPlayerId?: string;
  guess?: string;
  skip?: boolean;
}

// Catch Mind types
export type CatchMindPhase = "role-reveal" | "drawing" | "round-result" | "final-result";

export interface CatchMindPlayerState {
  id: string;
  nickname: string;
  score: number;
  hasGuessedCorrectly: boolean;
}

export interface CatchMindPublicState {
  phase: CatchMindPhase;
  roundNumber: number;
  totalRounds: number;
  drawerId: string;
  drawTimeSeconds: number;
  turnStartedAt: number | null;
  players: CatchMindPlayerState[];
  canvas: DrawPoint[];
  keyword: string | null;
  keywordLength: number | null;
  firstGuesserId: string | null;
  allGuessedCorrectly: boolean;
  roundScores: Record<string, number>;
  showCharHint: boolean;
}

export interface CatchMindPrivateState {
  keyword: string;
}

export interface CatchMindMove {
  type: "draw" | "clear-canvas" | "phase-ready";
  points?: DrawPoint[];
}

export type GameState = GomokuState | HoldemPublicState | MinesweeperPublicState | TetrisPublicState | LiarDrawingPublicState | CatchMindPublicState;
export type GameMove = GomokuMove | HoldemMove | MinesweeperMove | TetrisMove | LiarDrawingMove | CatchMindMove;

export interface GameResult {
  winnerId: string | null; // null = draw
  reason: string;
}
