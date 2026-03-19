import type { Player, GomokuState, GomokuMove, GameResult } from "@game-hub/shared-types";
import type { GameEngine } from "./engine-interface.js";

export class GomokuEngine implements GameEngine {
  gameType = "gomoku" as const;
  minPlayers = 2;
  maxPlayers = 2;

  initState(players: Player[]): GomokuState {
    const board: (null | "black" | "white")[][] = Array.from({ length: 15 }, () =>
      Array(15).fill(null)
    );
    return {
      board,
      currentTurn: "black",
      players: {
        black: players[0].id,
        white: players[1].id,
      },
      lastMove: null,
      moveCount: 0,
    };
  }

  processMove(state: GomokuState, playerId: string, move: GomokuMove): GomokuState {
    const { row, col } = move;
    if (row < 0 || row >= 15 || col < 0 || col >= 15) return state;
    if (state.board[row][col] !== null) return state;
    if (state.players[state.currentTurn] !== playerId) return state;

    const newBoard = state.board.map((r) => [...r]);
    newBoard[row][col] = state.currentTurn;

    return {
      ...state,
      board: newBoard,
      currentTurn: state.currentTurn === "black" ? "white" : "black",
      lastMove: { row, col },
      moveCount: state.moveCount + 1,
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
      let count = 1;
      for (let d = 1; d < 5; d++) {
        const r = row + dr * d;
        const c = col + dc * d;
        if (r < 0 || r >= 15 || c < 0 || c >= 15) break;
        if (state.board[r][c] !== stone) break;
        count++;
      }
      for (let d = 1; d < 5; d++) {
        const r = row - dr * d;
        const c = col - dc * d;
        if (r < 0 || r >= 15 || c < 0 || c >= 15) break;
        if (state.board[r][c] !== stone) break;
        count++;
      }
      if (count >= 5) {
        return {
          winnerId: state.players[stone],
          reason: `${stone === "black" ? "흑" : "백"}이 5목을 완성했습니다!`,
        };
      }
    }

    // Check draw
    if (state.moveCount >= 225) {
      return { winnerId: null, reason: "무승부입니다!" };
    }

    return null;
  }
}
