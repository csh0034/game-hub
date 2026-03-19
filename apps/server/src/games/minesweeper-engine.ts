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

interface MinesweeperInternalCell {
  hasMine: boolean;
  adjacentMines: number;
  status: "hidden" | "revealed" | "flagged";
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

        if (!this.minesPlaced) {
          this.placeMines(m.row, m.col);
          this.startedAt = Date.now();
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
      case "unflag": {
        if (cell.status !== "flagged") return this.toPublicState();
        cell.status = "hidden";
        this.flagCount--;
        break;
      }
    }

    return this.toPublicState();
  }

  checkWin(_state: GameState): GameResult | null {
    if (this.status === "won") {
      return { winnerId: this.playerId, reason: "모든 안전한 칸을 열었습니다!" };
    }
    if (this.status === "lost") {
      return { winnerId: null, reason: "지뢰를 밟았습니다!" };
    }
    return null;
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
      if (cell.status === "flagged") continue;
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
