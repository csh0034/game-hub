import type {
  Player,
  NonogramPublicState,
  NonogramPlayerBoard,
  NonogramCellStatus,
  NonogramMove,
  NonogramDifficulty,
  GameResult,
  GameState,
  GameMove,
} from "@game-hub/shared-types";
import { NONOGRAM_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";
import { NONOGRAM_PATTERNS } from "./nonogram-patterns.js";

export class NonogramEngine implements GameEngine {
  gameType = "nonogram" as const;
  minPlayers = 1;
  maxPlayers = 1;

  private difficulty: NonogramDifficulty;
  private rows: number;
  private cols: number;
  private fillRatio: number;
  private solution: boolean[][] = [];
  private rowHints: number[][] = [];
  private colHints: number[][] = [];
  private playerState: NonogramPlayerBoard | null = null;
  private playerId = "";
  private startedAt: number | null = null;
  private history: { row: number; col: number; from: NonogramCellStatus; to: NonogramCellStatus }[][] = [];
  private redoStack: { row: number; col: number; from: NonogramCellStatus; to: NonogramCellStatus }[][] = [];

  constructor(difficulty: NonogramDifficulty = "beginner") {
    this.difficulty = difficulty;
    const config = NONOGRAM_DIFFICULTY_CONFIGS[difficulty];
    this.rows = config.rows;
    this.cols = config.cols;
    this.fillRatio = config.fillRatio;
  }

  initState(players: Player[]): NonogramPublicState {
    this.playerId = players[0].id;
    this.startedAt = Date.now();

    this.generatePuzzle();

    const board: NonogramCellStatus[][] = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => "hidden" as const),
    );
    this.playerState = {
      board,
      progress: 0,
      status: "playing",
      completedAt: null,
    };

    return this.toPublicState();
  }

  processMove(state: GameState, playerId: string, move: GameMove): NonogramPublicState {
    const m = move as NonogramMove;
    const ps = this.playerState;
    if (!ps || ps.status !== "playing") return this.toPublicState();
    if (playerId !== this.playerId) return this.toPublicState();
    if (m.row < 0 || m.row >= this.rows || m.col < 0 || m.col >= this.cols) {
      return this.toPublicState();
    }

    const from = ps.board[m.row][m.col];
    let to: NonogramCellStatus;

    switch (m.type) {
      case "fill": to = "filled"; break;
      case "mark": to = "marked"; break;
      case "clear": to = "hidden"; break;
    }

    if (from === to) return this.toPublicState();

    ps.board[m.row][m.col] = to;
    this.history.push([{ row: m.row, col: m.col, from, to }]);
    this.redoStack = [];

    this.updateProgressAndCheck(ps);
    return this.toPublicState();
  }

  /** 여러 셀을 한 번에 변경 (드래그용, 1개의 Undo 단위) */
  processBatchMove(playerId: string, moves: { row: number; col: number; target: NonogramCellStatus }[]): NonogramPublicState {
    const ps = this.playerState;
    if (!ps || ps.status !== "playing") return this.toPublicState();
    if (playerId !== this.playerId) return this.toPublicState();

    const diffs: { row: number; col: number; from: NonogramCellStatus; to: NonogramCellStatus }[] = [];

    for (const m of moves) {
      if (m.row < 0 || m.row >= this.rows || m.col < 0 || m.col >= this.cols) continue;
      const from = ps.board[m.row][m.col];
      if (from === m.target) continue;
      ps.board[m.row][m.col] = m.target;
      diffs.push({ row: m.row, col: m.col, from, to: m.target });
    }

    if (diffs.length > 0) {
      this.history.push(diffs);
      this.redoStack = [];
    }

    this.updateProgressAndCheck(ps);
    return this.toPublicState();
  }

  undo(): NonogramPublicState {
    const ps = this.playerState;
    if (!ps || ps.status !== "playing") return this.toPublicState();
    const entry = this.history.pop();
    if (!entry) return this.toPublicState();

    for (const diff of entry) {
      ps.board[diff.row][diff.col] = diff.from;
    }
    this.redoStack.push(entry);

    this.updateProgressAndCheck(ps);
    return this.toPublicState();
  }

  redo(): NonogramPublicState {
    const ps = this.playerState;
    if (!ps || ps.status !== "playing") return this.toPublicState();
    const entry = this.redoStack.pop();
    if (!entry) return this.toPublicState();

    for (const diff of entry) {
      ps.board[diff.row][diff.col] = diff.to;
    }
    this.history.push(entry);

    this.updateProgressAndCheck(ps);
    return this.toPublicState();
  }

  /** 보드 초기화 (같은 퍼즐, 빈 보드로) */
  restart(): NonogramPublicState {
    const ps = this.playerState;
    if (!ps || ps.status !== "playing") return this.toPublicState();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        ps.board[r][c] = "hidden";
      }
    }
    ps.progress = 0;
    this.history = [];
    this.redoStack = [];
    return this.toPublicState();
  }

  private updateProgressAndCheck(ps: NonogramPlayerBoard): void {
    ps.progress = this.calculateProgress(ps.board);
    if (this.checkSolution(ps.board)) {
      ps.status = "completed";
      ps.completedAt = Date.now();
    }
  }

  checkWin(_state: GameState): GameResult | null {
    if (this.playerState?.status === "completed") {
      const time = this.getCompletionTime();
      const timeStr = time !== null ? (time / 1000).toFixed(3) : "?";
      return { winnerId: this.playerId, reason: `클리어 시간: ${timeStr}초` };
    }
    return null;
  }

  /** 채운 칸 중 틀린 칸 수를 반환 */
  countErrors(): number {
    const ps = this.playerState;
    if (!ps) return 0;
    let errors = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (ps.board[r][c] === "filled" && !this.solution[r][c]) {
          errors++;
        }
      }
    }
    return errors;
  }

  getDifficulty(): NonogramDifficulty {
    return this.difficulty;
  }

  getCompletionTime(): number | null {
    const ps = this.playerState;
    if (!ps || ps.status !== "completed" || !this.startedAt || !ps.completedAt) return null;
    return ps.completedAt - this.startedAt;
  }

  private generatePuzzle(): void {
    const patterns = NONOGRAM_PATTERNS[this.difficulty];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    this.solution = pattern.map((row) => [...row]);
    this.rows = this.solution.length;
    this.cols = this.solution[0].length;
    this.rowHints = this.solution.map((row) => computeHints(row));
    this.colHints = Array.from({ length: this.cols }, (_, c) => {
      const col = this.solution.map((row) => row[c]);
      return computeHints(col);
    });
  }

  private calculateProgress(board: NonogramCellStatus[][]): number {
    const totalFilled = this.solution.flat().filter(Boolean).length;
    if (totalFilled === 0) return 100;
    let correctFilled = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (board[r][c] === "filled" && this.solution[r][c]) {
          correctFilled++;
        }
      }
    }
    return Math.round((correctFilled / totalFilled) * 100);
  }

  private checkSolution(board: NonogramCellStatus[][]): boolean {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const isFilled = board[r][c] === "filled";
        if (isFilled !== this.solution[r][c]) return false;
      }
    }
    return true;
  }

  toPublicState(): NonogramPublicState {
    const players: Record<string, NonogramPlayerBoard> = {};
    if (this.playerState) {
      players[this.playerId] = {
        ...this.playerState,
        board: this.playerState.board.map((row) => [...row]),
      };
    }
    return {
      players,
      rows: this.rows,
      cols: this.cols,
      rowHints: this.rowHints,
      colHints: this.colHints,
      difficulty: this.difficulty,
      startedAt: this.startedAt,
    };
  }

  // For testing
  _setSolution(solution: boolean[][]): void {
    this.solution = solution;
    this.rows = solution.length;
    this.cols = solution[0].length;
    this.rowHints = solution.map((row) => computeHints(row));
    this.colHints = Array.from({ length: this.cols }, (_, c) => {
      const col = solution.map((row) => row[c]);
      return computeHints(col);
    });
  }

  _getPlayerState(): NonogramPlayerBoard | null {
    return this.playerState;
  }
}

export function computeHints(line: boolean[]): number[] {
  const hints: number[] = [];
  let count = 0;
  for (const cell of line) {
    if (cell) {
      count++;
    } else if (count > 0) {
      hints.push(count);
      count = 0;
    }
  }
  if (count > 0) hints.push(count);
  return hints.length === 0 ? [0] : hints;
}
