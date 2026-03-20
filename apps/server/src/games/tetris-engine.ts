import type {
  Player,
  TetrominoType,
  TetrisActivePiece,
  TetrisPlayerBoard,
  TetrisPublicState,
  TetrisMove,
  TetrisDifficulty,
  TetrisMode,
  GameResult,
  GameState,
  GameMove,
} from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";

const BOARD_ROWS = 20;
const BOARD_COLS = 10;
const NEXT_PREVIEW_COUNT = 2;
const LINES_PER_LEVEL = 10;
const MIN_DROP_INTERVAL = 100;
const DROP_SPEED_DECREASE = 50;

const ALL_TETROMINOS: TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];

// Tetromino shapes: [row, col] offsets for each rotation state
const TETROMINO_SHAPES: Record<TetrominoType, [number, number][][]> = {
  I: [
    [[0, -1], [0, 0], [0, 1], [0, 2]],
    [[-1, 0], [0, 0], [1, 0], [2, 0]],
    [[0, -1], [0, 0], [0, 1], [0, 2]],
    [[-1, 0], [0, 0], [1, 0], [2, 0]],
  ],
  O: [
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
  ],
  T: [
    [[0, -1], [0, 0], [0, 1], [-1, 0]],
    [[-1, 0], [0, 0], [1, 0], [0, 1]],
    [[0, -1], [0, 0], [0, 1], [1, 0]],
    [[-1, 0], [0, 0], [1, 0], [0, -1]],
  ],
  S: [
    [[0, -1], [0, 0], [-1, 0], [-1, 1]],
    [[-1, 0], [0, 0], [0, 1], [1, 1]],
    [[0, -1], [0, 0], [-1, 0], [-1, 1]],
    [[-1, 0], [0, 0], [0, 1], [1, 1]],
  ],
  Z: [
    [[-1, -1], [-1, 0], [0, 0], [0, 1]],
    [[-1, 0], [0, 0], [0, -1], [1, -1]],
    [[-1, -1], [-1, 0], [0, 0], [0, 1]],
    [[-1, 0], [0, 0], [0, -1], [1, -1]],
  ],
  J: [
    [[0, -1], [0, 0], [0, 1], [-1, -1]],
    [[-1, 0], [0, 0], [1, 0], [-1, 1]],
    [[0, -1], [0, 0], [0, 1], [1, 1]],
    [[-1, 0], [0, 0], [1, 0], [1, -1]],
  ],
  L: [
    [[0, -1], [0, 0], [0, 1], [-1, 1]],
    [[-1, 0], [0, 0], [1, 0], [1, 1]],
    [[0, -1], [0, 0], [0, 1], [1, -1]],
    [[-1, 0], [0, 0], [1, 0], [-1, -1]],
  ],
};

// SRS wall kick offsets: [dx_col, dy_row]
const SRS_OFFSETS_JLSTZ: Record<string, [number, number][]> = {
  "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

const SRS_OFFSETS_I: Record<string, [number, number][]> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

const LINE_CLEAR_SCORES = [0, 100, 300, 500, 800];

interface PlayerInternalState {
  bag: TetrominoType[];
  board: (TetrominoType | null)[][];
  activePiece: TetrisActivePiece | null;
  holdPiece: TetrominoType | null;
  canHold: boolean;
  nextPieces: TetrominoType[];
  score: number;
  level: number;
  linesCleared: number;
  status: "playing" | "gameover";
  pendingGarbage: number;
}

export class TetrisEngine implements GameEngine {
  gameType = "tetris" as const;
  minPlayers = 1;
  maxPlayers = 8;

  private playerStates: Map<string, PlayerInternalState> = new Map();
  private playerIds: string[] = [];
  private difficulty: TetrisDifficulty;
  private mode: TetrisMode = "solo";
  private baseInterval: number;
  private startLevel: number;

  constructor(difficulty: TetrisDifficulty = "normal") {
    this.difficulty = difficulty;
    const configs = { easy: { initialInterval: 1000, startLevel: 1 }, normal: { initialInterval: 800, startLevel: 1 }, hard: { initialInterval: 400, startLevel: 5 } };
    this.baseInterval = configs[difficulty].initialInterval;
    this.startLevel = configs[difficulty].startLevel;
  }

  initState(players: Player[]): TetrisPublicState {
    this.playerIds = players.map((p) => p.id);
    this.mode = players.length === 1 ? "solo" : "versus";
    this.playerStates.clear();

    for (const player of players) {
      const internal: PlayerInternalState = {
        bag: [],
        board: this.createEmptyBoard(),
        activePiece: null,
        holdPiece: null,
        canHold: true,
        nextPieces: [],
        score: 0,
        level: this.startLevel,
        linesCleared: 0,
        status: "playing",
        pendingGarbage: 0,
      };

      this.fillBag(internal);
      this.fillNextPieces(internal);
      this.spawnPiece(internal);
      this.playerStates.set(player.id, internal);
    }

    return this.toPublicState();
  }

  processMove(_state: GameState, playerId: string, move: GameMove): TetrisPublicState {
    const m = move as TetrisMove;
    const ps = this.playerStates.get(playerId);
    if (!ps || ps.status !== "playing" || !ps.activePiece) {
      return this.toPublicState();
    }

    switch (m.type) {
      case "move-left":
        this.tryMove(ps, 0, -1);
        break;
      case "move-right":
        this.tryMove(ps, 0, 1);
        break;
      case "rotate-cw":
        this.tryRotate(ps, 1);
        break;
      case "rotate-ccw":
        this.tryRotate(ps, -1);
        break;
      case "soft-drop":
        if (this.tryMove(ps, 1, 0)) {
          ps.score += 1;
        }
        break;
      case "hard-drop":
        this.hardDrop(ps);
        break;
      case "hold":
        this.holdPiece(ps);
        break;
      case "tick":
        this.tick(ps);
        break;
    }

    return this.toPublicState();
  }

  checkWin(state: GameState): GameResult | null {
    if (this.mode === "solo") {
      const ps = this.playerStates.get(this.playerIds[0]);
      if (ps && ps.status === "gameover") {
        return { winnerId: null, reason: `점수: ${ps.score}` };
      }
      return null;
    }

    // versus mode
    const alive = this.playerIds.filter((id) => {
      const ps = this.playerStates.get(id);
      return ps && ps.status === "playing";
    });

    if (alive.length === 1) {
      const winnerScore = this.playerStates.get(alive[0])?.score ?? 0;
      return { winnerId: alive[0], reason: `점수: ${winnerScore}` };
    }
    if (alive.length === 0) {
      return { winnerId: null, reason: "무승부" };
    }
    return null;
  }

  // --- Internal methods ---

  private createEmptyBoard(): (TetrominoType | null)[][] {
    return Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null));
  }

  private fillBag(ps: PlayerInternalState): void {
    const pieces = [...ALL_TETROMINOS];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    ps.bag.push(...pieces);
  }

  private fillNextPieces(ps: PlayerInternalState): void {
    while (ps.nextPieces.length < NEXT_PREVIEW_COUNT) {
      if (ps.bag.length === 0) this.fillBag(ps);
      ps.nextPieces.push(ps.bag.shift()!);
    }
  }

  private spawnPiece(ps: PlayerInternalState): void {
    if (ps.bag.length === 0) this.fillBag(ps);
    this.fillNextPieces(ps);

    const type = ps.nextPieces.shift()!;
    this.fillNextPieces(ps);

    const piece: TetrisActivePiece = {
      type,
      row: 1,
      col: Math.floor(BOARD_COLS / 2) - 1,
      rotation: 0,
    };

    if (!this.isValidPosition(ps.board, piece)) {
      ps.status = "gameover";
      ps.activePiece = null;
      return;
    }

    ps.activePiece = piece;
    ps.canHold = true;
  }

  private isValidPosition(board: (TetrominoType | null)[][], piece: TetrisActivePiece): boolean {
    const cells = TETROMINO_SHAPES[piece.type][piece.rotation];
    for (const [dr, dc] of cells) {
      const r = piece.row + dr;
      const c = piece.col + dc;
      if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
      if (board[r][c] !== null) return false;
    }
    return true;
  }

  private tryMove(ps: PlayerInternalState, dRow: number, dCol: number): boolean {
    if (!ps.activePiece) return false;
    const moved: TetrisActivePiece = {
      ...ps.activePiece,
      row: ps.activePiece.row + dRow,
      col: ps.activePiece.col + dCol,
    };
    if (this.isValidPosition(ps.board, moved)) {
      ps.activePiece = moved;
      return true;
    }
    return false;
  }

  private tryRotate(ps: PlayerInternalState, direction: 1 | -1): boolean {
    if (!ps.activePiece) return false;
    if (ps.activePiece.type === "O") return true;

    const fromRot = ps.activePiece.rotation;
    const toRot = ((fromRot + direction + 4) % 4) as 0 | 1 | 2 | 3;
    const key = `${fromRot}>${toRot}`;

    const offsets = ps.activePiece.type === "I" ? SRS_OFFSETS_I[key] : SRS_OFFSETS_JLSTZ[key];
    if (!offsets) return false;

    for (const [dx, dy] of offsets) {
      const rotated: TetrisActivePiece = {
        ...ps.activePiece,
        rotation: toRot,
        col: ps.activePiece.col + dx,
        row: ps.activePiece.row + dy,
      };
      if (this.isValidPosition(ps.board, rotated)) {
        ps.activePiece = rotated;
        return true;
      }
    }
    return false;
  }

  private hardDrop(ps: PlayerInternalState): void {
    if (!ps.activePiece) return;
    let dropDistance = 0;
    while (this.tryMove(ps, 1, 0)) {
      dropDistance++;
    }
    ps.score += dropDistance * 2;
    this.lockPiece(ps);
  }

  private tick(ps: PlayerInternalState): void {
    if (!ps.activePiece) return;
    if (!this.tryMove(ps, 1, 0)) {
      this.lockPiece(ps);
    }
  }

  private lockPiece(ps: PlayerInternalState): void {
    if (!ps.activePiece) return;

    const cells = TETROMINO_SHAPES[ps.activePiece.type][ps.activePiece.rotation];
    for (const [dr, dc] of cells) {
      const r = ps.activePiece.row + dr;
      const c = ps.activePiece.col + dc;
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
        ps.board[r][c] = ps.activePiece.type;
      }
    }

    ps.activePiece = null;

    // Apply pending garbage before clearing lines
    this.applyGarbage(ps);

    const cleared = this.clearLines(ps);

    // Send garbage to opponent in versus mode
    if (cleared >= 2 && this.mode === "versus") {
      const garbageLines = cleared - 1;
      for (const id of this.playerIds) {
        if (id !== this.getCurrentPlayerId(ps)) {
          const opponent = this.playerStates.get(id);
          if (opponent && opponent.status === "playing") {
            opponent.pendingGarbage += garbageLines;
          }
        }
      }
    }

    if (cleared > 0) {
      ps.score += LINE_CLEAR_SCORES[cleared] * ps.level;
      ps.linesCleared += cleared;

      const newLevel = this.startLevel + Math.floor(ps.linesCleared / LINES_PER_LEVEL);
      if (newLevel > ps.level) {
        ps.level = newLevel;
      }
    }

    this.spawnPiece(ps);
  }

  private clearLines(ps: PlayerInternalState): number {
    let cleared = 0;
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      if (ps.board[r].every((cell) => cell !== null)) {
        ps.board.splice(r, 1);
        ps.board.unshift(Array.from({ length: BOARD_COLS }, () => null));
        cleared++;
        r++; // re-check same row index
      }
    }
    return cleared;
  }

  private applyGarbage(ps: PlayerInternalState): void {
    if (ps.pendingGarbage <= 0) return;

    const lines = ps.pendingGarbage;
    ps.pendingGarbage = 0;
    const gapCol = Math.floor(Math.random() * BOARD_COLS);

    for (let i = 0; i < lines; i++) {
      ps.board.shift();
      const garbageRow: (TetrominoType | null)[] = Array.from({ length: BOARD_COLS }, (_, c) =>
        c === gapCol ? null : ("Z" as TetrominoType),
      );
      ps.board.push(garbageRow);
    }
  }

  private holdPiece(ps: PlayerInternalState): void {
    if (!ps.activePiece || !ps.canHold) return;

    const currentType = ps.activePiece.type;
    if (ps.holdPiece) {
      const holdType = ps.holdPiece;
      ps.holdPiece = currentType;
      ps.activePiece = {
        type: holdType,
        row: 1,
        col: Math.floor(BOARD_COLS / 2) - 1,
        rotation: 0,
      };
      if (!this.isValidPosition(ps.board, ps.activePiece)) {
        ps.status = "gameover";
        ps.activePiece = null;
        return;
      }
    } else {
      ps.holdPiece = currentType;
      ps.activePiece = null;
      this.spawnPiece(ps);
    }
    ps.canHold = false;
  }

  private calculateGhostRow(board: (TetrominoType | null)[][], piece: TetrisActivePiece): number {
    let ghostRow = piece.row;
    const ghost: TetrisActivePiece = { ...piece };
    while (true) {
      ghost.row = ghostRow + 1;
      if (!this.isValidPosition(board, ghost)) break;
      ghostRow++;
    }
    return ghostRow;
  }

  private getCurrentPlayerId(ps: PlayerInternalState): string | undefined {
    for (const [id, state] of this.playerStates.entries()) {
      if (state === ps) return id;
    }
    return undefined;
  }

  private calculateDropInterval(): number {
    let maxLevel = this.startLevel;
    for (const ps of this.playerStates.values()) {
      if (ps.level > maxLevel) maxLevel = ps.level;
    }
    return Math.max(this.baseInterval - (maxLevel - 1) * DROP_SPEED_DECREASE, MIN_DROP_INTERVAL);
  }

  tickAll(): TetrisPublicState {
    for (const ps of this.playerStates.values()) {
      if (ps.status === "playing" && ps.activePiece) {
        this.tick(ps);
      }
    }
    return this.toPublicState();
  }

  toPublicState(): TetrisPublicState {
    const players: Record<string, TetrisPlayerBoard> = {};

    for (const [id, ps] of this.playerStates.entries()) {
      const ghostRow = ps.activePiece ? this.calculateGhostRow(ps.board, ps.activePiece) : 0;

      players[id] = {
        board: ps.board.map((row) => [...row]),
        activePiece: ps.activePiece ? { ...ps.activePiece } : null,
        ghostRow,
        holdPiece: ps.holdPiece,
        canHold: ps.canHold,
        nextPieces: [...ps.nextPieces],
        score: ps.score,
        level: ps.level,
        linesCleared: ps.linesCleared,
        status: ps.status,
        pendingGarbage: ps.pendingGarbage,
      };
    }

    return {
      players,
      difficulty: this.difficulty,
      mode: this.mode,
      dropInterval: this.calculateDropInterval(),
    };
  }
}
