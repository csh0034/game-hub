import type {
  Player,
  MinesweeperPublicState,
  MinesweeperPublicCell,
  MinesweeperMove,
  MinesweeperDifficulty,
  MinesweeperDifficultyConfig,
  GameResult,
  GameState,
  GameMove,
} from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";

const DIFFICULTY_CONFIGS: Record<MinesweeperDifficulty, MinesweeperDifficultyConfig> = {
  beginner: { rows: 9, cols: 9, mineCount: 10, label: "초급" },
  intermediate: { rows: 16, cols: 16, mineCount: 40, label: "중급" },
  expert: { rows: 16, cols: 30, mineCount: 99, label: "고급" },
};

// 난이도별 최소 클리어 시간 (ms) — 이보다 빠른 기록은 자동화로 간주하여 랭킹 등록 거부
const MIN_COMPLETION_TIME: Record<MinesweeperDifficulty, number> = {
  beginner: 3000,
  intermediate: 15000,
  expert: 35000,
};

// reveal/chord 간 최소 간격 (ms) — 자동화 클릭 방지
const MIN_REVEAL_INTERVAL = 50;

// 난이도별 최소 직접 클릭 수 (floodFill 제외, 사용자의 reveal/chord 액션 수)
const MIN_MOVE_COUNT: Record<MinesweeperDifficulty, number> = {
  beginner: 3,
  intermediate: 10,
  expert: 15,
};

// 난이도별 사고 구간 요구 (긴 멈춤이 일정 횟수 이상 있어야 인간으로 판정)
const THINK_PAUSE: Record<MinesweeperDifficulty, { minPauses: number; pauseMs: number }> = {
  beginner: { minPauses: 0, pauseMs: 1500 },
  intermediate: { minPauses: 1, pauseMs: 2000 },
  expert: { minPauses: 2, pauseMs: 2000 },
};

interface MinesweeperInternalCell {
  hasMine: boolean;
  adjacentMines: number;
  status: "hidden" | "revealed" | "flagged" | "questioned";
}

export class MinesweeperEngine implements GameEngine {
  gameType = "minesweeper" as const;
  minPlayers = 1;
  maxPlayers = 1;

  private board: MinesweeperInternalCell[][] = [];
  private difficulty: MinesweeperDifficulty;
  private rows: number;
  private cols: number;
  private mineCount: number;
  private minesPlaced = false;
  private playerId = "";
  private status: "playing" | "won" | "lost" = "playing";
  private flagCount = 0;
  private revealedCount = 0;
  private startedAt: number | null = null;
  private completedAt: number | null = null;
  private lastRevealAt = 0;
  private moveTimestamps: number[] = [];
  private moveCount = 0;

  constructor(difficulty: MinesweeperDifficulty = "beginner") {
    this.difficulty = difficulty;
    const config = DIFFICULTY_CONFIGS[difficulty];
    this.rows = config.rows;
    this.cols = config.cols;
    this.mineCount = config.mineCount;
  }

  initState(players: Player[]): MinesweeperPublicState {
    this.playerId = players[0].id;
    this.status = "playing";
    this.minesPlaced = false;
    this.flagCount = 0;
    this.revealedCount = 0;
    this.startedAt = null;
    this.completedAt = null;
    this.lastRevealAt = 0;
    this.moveTimestamps = [];
    this.moveCount = 0;

    this.board = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({
        hasMine: false,
        adjacentMines: 0,
        status: "hidden" as const,
      })),
    );

    return this.toPublicState();
  }

  processMove(state: GameState, playerId: string, move: GameMove): MinesweeperPublicState {
    const m = move as MinesweeperMove;

    if (playerId !== this.playerId) return this.toPublicState();
    if (this.status !== "playing") return this.toPublicState();
    if (m.row < 0 || m.row >= this.rows || m.col < 0 || m.col >= this.cols) {
      return this.toPublicState();
    }

    const cell = this.board[m.row][m.col];

    switch (m.type) {
      case "reveal": {
        if (cell.status !== "hidden") return this.toPublicState();

        const now = Date.now();
        if (now - this.lastRevealAt < MIN_REVEAL_INTERVAL) return this.toPublicState();
        this.lastRevealAt = now;
        this.moveCount++;
        this.moveTimestamps.push(now);

        if (!this.minesPlaced) {
          this.placeMines(m.row, m.col);
          this.startedAt = now;
        }

        if (cell.hasMine) {
          this.status = "lost";
          cell.status = "revealed";
          return this.toPublicState();
        }

        this.floodFill(m.row, m.col);
        this.checkWinCondition();
        break;
      }
      case "flag": {
        if (cell.status !== "hidden") return this.toPublicState();
        cell.status = "flagged";
        this.flagCount++;
        break;
      }
      case "question": {
        if (cell.status !== "flagged") return this.toPublicState();
        cell.status = "questioned";
        this.flagCount--;
        break;
      }
      case "unquestion": {
        if (cell.status !== "questioned") return this.toPublicState();
        cell.status = "hidden";
        break;
      }
      case "chord": {
        if (cell.status !== "revealed") return this.toPublicState();
        if (cell.adjacentMines === 0) return this.toPublicState();

        const chordNow = Date.now();
        if (chordNow - this.lastRevealAt < MIN_REVEAL_INTERVAL) return this.toPublicState();
        this.lastRevealAt = chordNow;
        this.moveCount++;
        this.moveTimestamps.push(chordNow);

        let adjacentFlags = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = m.row + dr;
            const nc = m.col + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
              if (this.board[nr][nc].status === "flagged") adjacentFlags++;
            }
          }
        }

        if (adjacentFlags !== cell.adjacentMines) return this.toPublicState();

        let hitMine = false;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = m.row + dr;
            const nc = m.col + dc;
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
            const neighbor = this.board[nr][nc];
            if (neighbor.status !== "hidden") continue;

            if (neighbor.hasMine) {
              neighbor.status = "revealed";
              hitMine = true;
            } else {
              this.floodFill(nr, nc);
            }
          }
        }

        if (hitMine) {
          this.status = "lost";
        } else {
          this.checkWinCondition();
        }
        break;
      }
    }

    return this.toPublicState();
  }

  checkWin(_state: GameState): GameResult | null {
    if (this.status === "won") {
      const completionTime = this.getCompletionTime();
      return {
        winnerId: this.playerId,
        reason: "모든 안전한 칸을 열었습니다!",
        ...(completionTime != null && { completionTimeMs: completionTime }),
      };
    }
    if (this.status === "lost") {
      return { winnerId: null, reason: "지뢰를 밟았습니다!" };
    }
    return null;
  }

  getCompletionTime(): number | null {
    if (this.status !== "won" || !this.startedAt || !this.completedAt) return null;
    const time = this.completedAt - this.startedAt;
    if (time < MIN_COMPLETION_TIME[this.difficulty]) return null;

    // 최소 클릭 수 검증
    if (this.moveCount < MIN_MOVE_COUNT[this.difficulty]) return null;

    // 봇 탐지 검증
    const humanCheck = this.validateHumanPlay();
    if (!humanCheck.valid) return null;

    return time;
  }

  private validateHumanPlay(): { valid: boolean; reason?: string } {
    if (this.moveTimestamps.length < 5) return { valid: true };

    const intervals: number[] = [];
    for (let i = 1; i < this.moveTimestamps.length; i++) {
      intervals.push(this.moveTimestamps[i] - this.moveTimestamps[i - 1]);
    }

    // 검증 1: 클릭 간격의 변동 계수(CV) — 너무 균일하면 봇
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean > 0) {
      const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev / mean < 0.05) {
        return { valid: false, reason: "클릭 간격이 비정상적으로 균일합니다" };
      }
    }

    // 검증 2: 최소 간격 근처 클릭 비율 — 80% 이상이 최소 간격+30ms 이내면 봇
    const nearMinCount = intervals.filter((i) => i < MIN_REVEAL_INTERVAL + 30).length;
    if (nearMinCount / intervals.length > 0.8) {
      return { valid: false, reason: "대부분의 클릭이 최소 간격 근처입니다" };
    }

    // 검증 3: 사고 구간 — 난이도별 긴 멈춤 횟수 요구
    const cfg = THINK_PAUSE[this.difficulty];
    if (cfg.minPauses > 0) {
      const longPauses = intervals.filter((i) => i > cfg.pauseMs).length;
      if (longPauses < cfg.minPauses) {
        return { valid: false, reason: "사고 구간이 부족합니다" };
      }
    }

    return { valid: true };
  }

  getDifficulty(): MinesweeperDifficulty {
    return this.difficulty;
  }

  toPublicState(): MinesweeperPublicState {
    const board: MinesweeperPublicCell[][] = this.board.map((row) =>
      row.map((cell) => {
        const publicCell: MinesweeperPublicCell = { status: cell.status };
        if (cell.status === "revealed") {
          publicCell.adjacentMines = cell.adjacentMines;
          if (cell.hasMine) publicCell.hasMine = true;
        }
        if (this.status === "lost" && cell.hasMine) {
          publicCell.hasMine = true;
        }
        return publicCell;
      }),
    );

    return {
      board,
      rows: this.rows,
      cols: this.cols,
      mineCount: this.mineCount,
      flagCount: this.flagCount,
      revealedCount: this.revealedCount,
      difficulty: this.difficulty,
      status: this.status,
      playerId: this.playerId,
      startedAt: this.startedAt,
    };
  }

  private placeMines(safeRow: number, safeCol: number): void {
    const safeCells = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        safeCells.add(`${safeRow + dr},${safeCol + dc}`);
      }
    }

    let placed = 0;
    while (placed < this.mineCount) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      if (safeCells.has(`${r},${c}`)) continue;
      if (this.board[r][c].hasMine) continue;
      this.board[r][c].hasMine = true;
      placed++;
    }

    // Calculate adjacent mine counts
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].hasMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc].hasMine) {
              count++;
            }
          }
        }
        this.board[r][c].adjacentMines = count;
      }
    }

    this.minesPlaced = true;
  }

  private floodFill(row: number, col: number): void {
    const queue: [number, number][] = [[row, col]];

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;

      const cell = this.board[r][c];
      if (cell.status === "revealed") continue;
      if (cell.status === "flagged" || cell.status === "questioned") continue;
      if (cell.hasMine) continue;

      cell.status = "revealed";
      this.revealedCount++;

      if (cell.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            queue.push([r + dr, c + dc]);
          }
        }
      }
    }
  }

  private checkWinCondition(): void {
    const totalSafeCells = this.rows * this.cols - this.mineCount;
    if (this.revealedCount >= totalSafeCells) {
      this.status = "won";
      this.completedAt = Date.now();
    }
  }

  // For testing: directly set internal board state
  _setBoard(board: MinesweeperInternalCell[][]): void {
    this.board = board;
    this.minesPlaced = true;
    this.revealedCount = 0;
    this.flagCount = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell.status === "revealed") this.revealedCount++;
        if (cell.status === "flagged") this.flagCount++;
      }
    }
  }

  _setStartedAt(time: number): void {
    this.startedAt = time;
  }
}
