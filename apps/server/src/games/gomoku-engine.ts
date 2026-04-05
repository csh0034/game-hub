import type { Player, GomokuState, GomokuMove, GameResult, GomokuFirstColor, GomokuRuleType } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";
import { isForbiddenMove, getForbiddenMoves } from "./gomoku-renju-rule.js";

export class GomokuEngine implements GameEngine {
  gameType = "gomoku" as const;
  minPlayers = 2;
  maxPlayers = 2;
  private turnTimeSeconds: number;
  private firstColor: GomokuFirstColor;
  private ruleType: GomokuRuleType;

  constructor(turnTime: number = 30, firstColor: GomokuFirstColor = "host", ruleType: GomokuRuleType = "free") {
    this.turnTimeSeconds = turnTime;
    this.firstColor = firstColor;
    this.ruleType = ruleType;
  }

  initState(players: Player[]): GomokuState {
    const board: (null | "black" | "white")[][] = Array.from({ length: 15 }, () =>
      Array(15).fill(null)
    );
    const now = Date.now();
    const blackPlayer = this.firstColor === "guest" ? players[1] : players[0];
    const whitePlayer = this.firstColor === "guest" ? players[0] : players[1];
    return {
      board,
      currentTurn: "black",
      players: {
        black: blackPlayer.id,
        white: whitePlayer.id,
      },
      lastMove: null,
      moveCount: 0,
      turnStartedAt: now,
      gameStartedAt: now,
      turnTimeSeconds: this.turnTimeSeconds,
      winLine: null,
      forbiddenMoves: this.ruleType === "renju" ? [] : null,
    };
  }

  processMove(state: GomokuState, playerId: string, move: GomokuMove): GomokuState {
    const { row, col } = move;
    if (row < 0 || row >= 15 || col < 0 || col >= 15) return state;
    if (state.board[row][col] !== null) return state;
    if (state.players[state.currentTurn] !== playerId) return state;

    // Renju: block forbidden moves for black
    if (this.ruleType === "renju" && state.currentTurn === "black") {
      if (isForbiddenMove(state.board, row, col)) return state;
    }

    const newBoard = state.board.map((r) => [...r]);
    newBoard[row][col] = state.currentTurn;

    const nextTurn = state.currentTurn === "black" ? "white" : "black";

    return {
      ...state,
      board: newBoard,
      currentTurn: nextTurn,
      lastMove: { row, col },
      moveCount: state.moveCount + 1,
      turnStartedAt: Date.now(),
      forbiddenMoves: this.ruleType === "renju"
        ? (nextTurn === "black" ? getForbiddenMoves(newBoard) : [])
        : null,
    };
  }

  checkWin(state: GomokuState): GameResult | null {
    if (!state.lastMove) return null;
    const { row, col } = state.lastMove;
    // The stone that was just placed is the opposite of currentTurn (since we already switched)
    const stone = state.currentTurn === "black" ? "white" : "black";

    const directions = [
      [0, 1],  // horizontal
      [1, 0],  // vertical
      [1, 1],  // diagonal
      [1, -1], // anti-diagonal
    ];

    for (const [dr, dc] of directions) {
      const cells: { row: number; col: number }[] = [{ row, col }];
      for (let d = 1; d < 5; d++) {
        const r = row + dr * d;
        const c = col + dc * d;
        if (r < 0 || r >= 15 || c < 0 || c >= 15) break;
        if (state.board[r][c] !== stone) break;
        cells.push({ row: r, col: c });
      }
      for (let d = 1; d < 5; d++) {
        const r = row - dr * d;
        const c = col - dc * d;
        if (r < 0 || r >= 15 || c < 0 || c >= 15) break;
        if (state.board[r][c] !== stone) break;
        cells.push({ row: r, col: c });
      }

      // Renju: black must have exactly 5 (overline is blocked in processMove, but defend here too)
      if (this.ruleType === "renju" && stone === "black") {
        if (cells.length === 5) {
          state.winLine = cells;
          return {
            winnerId: state.players[stone],
            reason: "흑이 5목을 완성했습니다!",
          };
        }
      } else {
        if (cells.length >= 5) {
          state.winLine = cells;
          return {
            winnerId: state.players[stone],
            reason: `${stone === "black" ? "흑" : "백"}이 ${cells.length}목을 완성했습니다!`,
          };
        }
      }
    }

    // Check draw
    if (state.moveCount >= 225) {
      return { winnerId: null, reason: "무승부입니다!" };
    }

    return null;
  }
}
