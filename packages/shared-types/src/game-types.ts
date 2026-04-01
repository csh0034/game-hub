export type GameType = "gomoku" | "minesweeper" | "tetris" | "liar-drawing" | "catch-mind" | "typing";

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
  typing: {
    gameType: "typing",
    name: "타자 게임",
    description: "위에서 내려오는 단어를 빠르게 입력하여 제거하는 타자 레이스",
    minPlayers: 1,
    maxPlayers: 8,
    icon: "⌨️",
  },
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
};

export type StoneColor = "black" | "white";
export type GomokuRuleType = "free" | "renju";

export interface GomokuState {
  board: (StoneColor | null)[][];
  currentTurn: StoneColor;
  players: Record<StoneColor, string>; // playerId
  lastMove: { row: number; col: number } | null;
  moveCount: number;
  turnStartedAt: number;
  gameStartedAt: number;
  turnTimeSeconds: number;
  winLine: { row: number; col: number }[] | null;
  forbiddenMoves: { row: number; col: number }[] | null;
}

export interface GomokuMove {
  row: number;
  col: number;
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

export type MinesweeperCellStatus = "hidden" | "revealed" | "flagged" | "questioned";

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
  type: "reveal" | "flag" | "question" | "unquestion" | "chord";
  row: number;
  col: number;
}

// Tetris types
export type TetrisGameMode = "classic" | "speed-race";
export const SPEED_RACE_TARGET_LINES = 40;

export type TetrisDifficulty = "beginner" | "intermediate" | "expert";

export interface TetrisDifficultyConfig {
  initialInterval: number;
  startLevel: number;
  label: string;
}

export const TETRIS_DIFFICULTY_CONFIGS: Record<TetrisDifficulty, TetrisDifficultyConfig> = {
  beginner: { initialInterval: 800, startLevel: 1, label: "초급" },
  intermediate: { initialInterval: 600, startLevel: 1, label: "중급" },
  expert: { initialInterval: 400, startLevel: 5, label: "고급" },
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

export interface TetrisPublicState {
  players: Record<string, TetrisPlayerBoard>;
  difficulty: TetrisDifficulty;
  gameMode: TetrisGameMode;
  dropInterval: number;
  startedAt: number | null;
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
  holdPiece: TetrominoType | null;
  canHold: boolean;
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
  keyword: string | null;
  roundScores: Record<string, number>;
}

export interface LiarDrawingPrivateState {
  role: "citizen" | "liar" | "spectator";
  keyword: string | null;
  liarId?: string;
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
  guessOrder: string[];
  roundEnded: boolean;
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

// Typing Game types
export type TypingDifficulty = "beginner" | "intermediate" | "expert";

export interface TypingDifficultyConfig {
  minChars: number;
  maxChars: number;
  fallDurationMs: number;
  maxWords: number;
  spawnIntervalMs: number;
  label: string;
}

export const TYPING_DIFFICULTY_CONFIGS: Record<TypingDifficulty, TypingDifficultyConfig> = {
  beginner: { minChars: 2, maxChars: 3, fallDurationMs: 6000, maxWords: 5, spawnIntervalMs: 2000, label: "초급" },
  intermediate: { minChars: 2, maxChars: 4, fallDurationMs: 4500, maxWords: 7, spawnIntervalMs: 1500, label: "중급" },
  expert: { minChars: 2, maxChars: 5, fallDurationMs: 3000, maxWords: 10, spawnIntervalMs: 1000, label: "고급" },
};

export interface TypingWord {
  id: number;
  text: string;
  spawnedAt: number;
  fallDurationMs: number;
  x: number; // 0~100 수평 위치 (퍼센트)
}

export type TypingPlayerStatus = "playing" | "gameover";

export interface TypingPlayerState {
  id: string;
  nickname: string;
  score: number;
  lives: number;
  combo: number;
  wordsCleared: number;
  status: TypingPlayerStatus;
}

export interface TypingPublicState {
  players: Record<string, TypingPlayerState>;
  words: TypingWord[];
  difficulty: TypingDifficulty;
  timeLimit: number;
  maxLives: number;
  startedAt: number;
  speedMultiplier: number;
  spawnMultiplier: number;
  countingDown?: boolean;
}

export interface TypingTickResult {
  spawnedWords: TypingWord[];
  missed: Record<string, number[]>;
  updatedPlayers: Record<string, TypingPlayerState>;
}

export interface TypingMove {
  type: "submit";
  word: string;
}

export type GameState = GomokuState | MinesweeperPublicState | TetrisPublicState | LiarDrawingPublicState | CatchMindPublicState | TypingPublicState;
export type GameMove = GomokuMove | MinesweeperMove | TetrisMove | LiarDrawingMove | CatchMindMove | TypingMove;

export interface GameResult {
  winnerId: string | null; // null = draw
  reason: string;
  completionTimeMs?: number;
  rankingResult?: {
    rank: number | null; // 1-based, null if not in top 10
    isNewRecord: boolean;
  };
}
