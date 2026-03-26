import type {
  Player,
  TetrominoType,
  TetrisActivePiece,
  TetrisPlayerBoard,
  TetrisPublicState,
  TetrisMove,
  TetrisDifficulty,
  TetrisGameMode,

  GameResult,
  GameState,
  GameMove,
} from "@game-hub/shared-types";
import { SPEED_RACE_TARGET_LINES } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";

const VISIBLE_ROWS = 20;
const BUFFER_ROWS = 4;
const BOARD_ROWS = VISIBLE_ROWS + BUFFER_ROWS; // 24 rows internally, top 4 hidden
const BOARD_COLS = 10;
const NEXT_PREVIEW_COUNT = 2;
const LINES_PER_LEVEL = 10;
const MIN_DROP_INTERVAL = 100;
const DROP_SPEED_DECREASE = 50;
const MAX_LOCK_DELAY_RESETS = 5;

const ALL_TETROMINOS: TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];

// 난이도별 최소 클리어 시간 (ms) — 이보다 빠른 기록은 자동화로 간주하여 랭킹 등록 거부
const MIN_COMPLETION_TIME: Record<TetrisDifficulty, number> = {
  beginner: 20000,
  intermediate: 15000,
  expert: 10000,
};

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
  lastMoveWasRotation: boolean;
  combo: number;
  backToBack: boolean;
  groundedLastTick: boolean;
  lockDelayResets: number;
  lastClearType: string | null;
  version: number;
}

export class TetrisEngine implements GameEngine {
  gameType = "tetris" as const;
  minPlayers = 1;
  maxPlayers = 8;

  private playerStates: Map<string, PlayerInternalState> = new Map();
  private playerIds: string[] = [];
  private difficulty: TetrisDifficulty;
  private gameMode: TetrisGameMode;
  private startedAt: number | null = null;
  private completedAt: number | null = null;

  private baseInterval: number;
  private startLevel: number;
  private dirtyPlayers: Set<string> = new Set();
  private boardDirtyPlayers: Set<string> = new Set(); // players whose board (not just piece) changed

  constructor(difficulty: TetrisDifficulty = "beginner", gameMode: TetrisGameMode = "classic") {
    this.difficulty = difficulty;
    this.gameMode = gameMode;
    const configs = { beginner: { initialInterval: 800, startLevel: 1 }, intermediate: { initialInterval: 600, startLevel: 1 }, expert: { initialInterval: 400, startLevel: 5 } };
    this.baseInterval = configs[difficulty].initialInterval;
    this.startLevel = configs[difficulty].startLevel;
  }

  initState(players: Player[]): TetrisPublicState {
    this.playerIds = players.map((p) => p.id);
    if (this.gameMode === "speed-race") {
      this.startedAt = Date.now();
    }

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
        lastMoveWasRotation: false,
        combo: 0,
        backToBack: false,
        groundedLastTick: false,
        lockDelayResets: 0,
        lastClearType: null,
        version: 0,
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

    ps.version++;
    this.dirtyPlayers.add(playerId);

    return this.toPublicState();
  }

  checkWin(_state: GameState): GameResult | null {
    // Speed race: check if any player cleared target lines
    if (this.gameMode === "speed-race") {
      for (const id of this.playerIds) {
        const ps = this.playerStates.get(id);
        if (ps && ps.linesCleared >= SPEED_RACE_TARGET_LINES) {
          if (!this.completedAt) this.completedAt = Date.now();
          const time = this.getCompletionTime();
          const timeStr = (time / 1000).toFixed(1);
          return { winnerId: id, reason: `클리어 시간: ${timeStr}초` };
        }
      }

      // Check for gameover before reaching target
      if (this.isSolo()) {
        const ps = this.playerStates.get(this.playerIds[0]);
        if (ps && ps.status === "gameover") {
          return { winnerId: null, reason: `게임 오버 (${ps.linesCleared}/${SPEED_RACE_TARGET_LINES})` };
        }
        return null;
      }

      // Versus speed race: last alive wins even without reaching target
      const alive = this.playerIds.filter((id) => {
        const ps = this.playerStates.get(id);
        return ps && ps.status === "playing";
      });

      if (alive.length === 1) {
        const winnerPs = this.playerStates.get(alive[0]);
        return { winnerId: alive[0], reason: `${winnerPs?.linesCleared ?? 0}/${SPEED_RACE_TARGET_LINES}줄` };
      }
      if (alive.length === 0) {
        return { winnerId: null, reason: "무승부" };
      }
      return null;
    }

    // Classic mode
    if (this.isSolo()) {
      const ps = this.playerStates.get(this.playerIds[0]);
      if (ps && ps.status === "gameover") {
        return { winnerId: null, reason: `점수: ${ps.score}` };
      }
      return null;
    }

    // Classic versus mode
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

  getPlayerScore(playerId: string): number {
    return this.playerStates.get(playerId)?.score ?? 0;
  }

  getDifficulty(): TetrisDifficulty {
    return this.difficulty;
  }

  isSolo(): boolean {
    return this.playerIds.length === 1;
  }

  isSpeedRace(): boolean {
    return this.gameMode === "speed-race";
  }

  getGameMode(): TetrisGameMode {
    return this.gameMode;
  }

  getCompletionTime(): number {
    if (!this.startedAt) return 0;
    if (this.completedAt) return this.completedAt - this.startedAt;
    return Date.now() - this.startedAt;
  }

  getValidatedCompletionTime(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    const time = this.completedAt - this.startedAt;
    if (time < MIN_COMPLETION_TIME[this.difficulty]) return null;
    return time;
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
      row: BUFFER_ROWS, // spawn at top of visible area (row 0 in client coords)
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
      ps.lastMoveWasRotation = false;
      if (dRow > 0) {
        // 아래로 이동 성공 — 더 이상 바닥이 아니므로 무조건 리셋
        ps.groundedLastTick = false;
        ps.lockDelayResets = 0;
      } else if (ps.groundedLastTick && ps.lockDelayResets < MAX_LOCK_DELAY_RESETS) {
        // 좌우 이동 — 제한된 횟수만큼 lock delay 리셋
        ps.lockDelayResets++;
        ps.groundedLastTick = false;
      }
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
        ps.lastMoveWasRotation = true;
        if (ps.groundedLastTick && ps.lockDelayResets < MAX_LOCK_DELAY_RESETS) {
          ps.lockDelayResets++;
          ps.groundedLastTick = false;
        }
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
    if (dropDistance > 0) {
      ps.lastMoveWasRotation = false;
    }
    this.lockPiece(ps);
  }

  private tick(ps: PlayerInternalState): void {
    if (!ps.activePiece) return;
    if (!this.tryMove(ps, 1, 0)) {
      if (ps.groundedLastTick) {
        this.lockPiece(ps);
      } else {
        ps.groundedLastTick = true;
      }
    }
  }

  private isTSpin(ps: PlayerInternalState): boolean {
    if (!ps.activePiece || ps.activePiece.type !== "T" || !ps.lastMoveWasRotation) return false;

    const centerRow = ps.activePiece.row;
    const centerCol = ps.activePiece.col;
    const corners: [number, number][] = [
      [centerRow - 1, centerCol - 1],
      [centerRow - 1, centerCol + 1],
      [centerRow + 1, centerCol - 1],
      [centerRow + 1, centerCol + 1],
    ];

    let occupied = 0;
    for (const [r, c] of corners) {
      if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS || ps.board[r][c] !== null) {
        occupied++;
      }
    }
    return occupied >= 3;
  }

  private lockPiece(ps: PlayerInternalState): void {
    if (!ps.activePiece) return;

    const currentPlayerId = this.getCurrentPlayerId(ps);
    const isTSpin = this.isTSpin(ps);

    const cells = TETROMINO_SHAPES[ps.activePiece.type][ps.activePiece.rotation];
    for (const [dr, dc] of cells) {
      const r = ps.activePiece.row + dr;
      const c = ps.activePiece.col + dc;
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
        ps.board[r][c] = ps.activePiece.type;
      }
    }

    ps.activePiece = null;
    ps.lastMoveWasRotation = false;
    ps.groundedLastTick = false;
    ps.lockDelayResets = 0;

    // Mark board as changed (lock = board mutation)
    if (currentPlayerId) {
      this.boardDirtyPlayers.add(currentPlayerId);
    }

    // Apply pending garbage before clearing lines
    this.applyGarbage(ps);

    const cleared = this.clearLines(ps);

    let garbageToSend = 0;

    if (cleared > 0) {
      ps.combo++;

      if (isTSpin) {
        // T-Spin scoring
        const tspinScores = [0, 800, 1200, 1600];
        const tspinGarbage = [0, 2, 4, 6];
        let score = tspinScores[cleared] * ps.level;
        garbageToSend = tspinGarbage[cleared];
        ps.lastClearType = cleared === 1 ? "tspin-single" : cleared === 2 ? "tspin-double" : "tspin-triple";

        if (ps.backToBack) {
          score = Math.floor(score * 1.5);
          garbageToSend += 1;
        }
        ps.backToBack = true;
        ps.score += score;
      } else if (cleared === 4) {
        // Tetris — difficult clear
        let score = LINE_CLEAR_SCORES[4] * ps.level;
        garbageToSend = 3;
        ps.lastClearType = "tetris";

        if (ps.backToBack) {
          score = Math.floor(score * 1.5);
          garbageToSend += 1;
        }
        ps.backToBack = true;
        ps.score += score;
      } else {
        // Normal clear (1-3 lines, no T-spin)
        ps.score += LINE_CLEAR_SCORES[cleared] * ps.level;
        garbageToSend = cleared >= 2 ? cleared - 1 : 0;
        ps.lastClearType = cleared === 1 ? "single" : cleared === 2 ? "double" : "triple";
        ps.backToBack = false;
      }

      // Combo bonus
      if (ps.combo > 0) {
        ps.score += 50 * ps.combo * ps.level;
      }

      // Combo garbage bonus (combo 4+ sends extra)
      if (ps.combo >= 4) {
        garbageToSend += ps.combo - 3;
      }

      ps.linesCleared += cleared;

      const newLevel = this.startLevel + Math.floor(ps.linesCleared / LINES_PER_LEVEL);
      if (newLevel > ps.level) {
        ps.level = newLevel;
      }

      // Send garbage in classic versus mode only
      if (garbageToSend > 0 && !this.isSolo() && this.gameMode !== "speed-race") {
        for (const id of this.playerIds) {
          if (id !== currentPlayerId) {
            const opponent = this.playerStates.get(id);
            if (opponent && opponent.status === "playing") {
              opponent.pendingGarbage += garbageToSend;
              opponent.version++;
              this.dirtyPlayers.add(id);
              this.boardDirtyPlayers.add(id);
            }
          }
        }
      }
    } else {
      // No lines cleared
      ps.combo = 0;
      ps.lastClearType = isTSpin ? "tspin-mini" : null;
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
        row: BUFFER_ROWS,
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
    ps.groundedLastTick = false;
    ps.lockDelayResets = 0;
    ps.lastMoveWasRotation = false;
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
    return Math.max(this.baseInterval - (maxLevel - this.startLevel) * DROP_SPEED_DECREASE, MIN_DROP_INTERVAL);
  }

  tickAll(): TetrisPublicState {
    for (const [id, ps] of this.playerStates.entries()) {
      if (ps.status === "playing" && ps.activePiece) {
        this.tick(ps);
        ps.version++;
        this.dirtyPlayers.add(id);
      }
    }
    return this.toPublicState();
  }

  toPublicState(): TetrisPublicState {
    const players: Record<string, TetrisPlayerBoard> = {};

    for (const [id, ps] of this.playerStates.entries()) {
      players[id] = this.playerToPublicBoard(ps);
    }

    return {
      players,
      difficulty: this.difficulty,
      gameMode: this.gameMode,
      dropInterval: this.calculateDropInterval(),
      startedAt: this.startedAt,
    };
  }

  toPublicStateForPlayer(playerId: string): TetrisPlayerBoard | null {
    const ps = this.playerStates.get(playerId);
    if (!ps) return null;
    return this.playerToPublicBoard(ps);
  }

  toPieceUpdate(playerId: string): { activePiece: TetrisActivePiece | null; ghostRow: number; version: number } | null {
    const ps = this.playerStates.get(playerId);
    if (!ps) return null;
    const ghostRow = ps.activePiece ? this.calculateGhostRow(ps.board, ps.activePiece) : 0;
    return {
      activePiece: ps.activePiece
        ? { ...ps.activePiece, row: ps.activePiece.row - BUFFER_ROWS }
        : null,
      ghostRow: ghostRow - BUFFER_ROWS,
      version: ps.version,
    };
  }

  getDirtyPlayers(): Set<string> {
    return new Set(this.dirtyPlayers);
  }

  getBoardDirtyPlayers(): Set<string> {
    return new Set(this.boardDirtyPlayers);
  }

  clearDirty(): void {
    this.dirtyPlayers.clear();
    this.boardDirtyPlayers.clear();
  }

  private playerToPublicBoard(ps: PlayerInternalState): TetrisPlayerBoard {
    const ghostRow = ps.activePiece ? this.calculateGhostRow(ps.board, ps.activePiece) - BUFFER_ROWS : 0;
    // Send only visible rows (skip buffer rows at top)
    const visibleBoard = ps.board.slice(BUFFER_ROWS).map((row) => [...row]);
    const activePiece = ps.activePiece
      ? { ...ps.activePiece, row: ps.activePiece.row - BUFFER_ROWS }
      : null;
    return {
      board: visibleBoard,
      activePiece,
      ghostRow,
      holdPiece: ps.holdPiece,
      canHold: ps.canHold,
      nextPieces: [...ps.nextPieces],
      score: ps.score,
      level: ps.level,
      linesCleared: ps.linesCleared,
      status: ps.status,
      pendingGarbage: ps.pendingGarbage,
      combo: ps.combo,
      backToBack: ps.backToBack,
      lastClearType: ps.lastClearType,
      version: ps.version,
    };
  }
}
