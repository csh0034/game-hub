import { describe, it, expect } from "vitest";
import { isForbiddenMove, getForbiddenMoves } from "./gomoku-renju-rule.js";
import type { StoneColor } from "@game-hub/shared-types";

type Board = (StoneColor | null)[][];

function emptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

function placeStones(board: Board, stones: { row: number; col: number; color: StoneColor }[]): void {
  for (const { row, col, color } of stones) {
    board[row][col] = color;
  }
}

describe("renju-rule", () => {
  describe("isForbiddenMove", () => {
    describe("5목 예외", () => {
      it("정확히 5목이 완성되면 금수가 아니다", () => {
        const board = emptyBoard();
        // 흑: (7,3)(7,4)(7,5)(7,6) — (7,7)에 놓으면 5목
        placeStones(board, [
          { row: 7, col: 3, color: "black" },
          { row: 7, col: 4, color: "black" },
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });

      it("삼삼이 되더라도 동시에 5목이 완성되면 금수가 아니다", () => {
        const board = emptyBoard();
        // 가로 5목: (7,3)(7,4)(7,5)(7,6) + (7,7)에 놓으면 5목
        placeStones(board, [
          { row: 7, col: 3, color: "black" },
          { row: 7, col: 4, color: "black" },
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
          // 세로에도 돌 배치 (삼삼 조건)
          { row: 5, col: 7, color: "black" },
          { row: 6, col: 7, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });
    });

    describe("장목 금수", () => {
      it("6목 이상 연속이면 금수이다", () => {
        const board = emptyBoard();
        // 흑: (7,2)(7,3)(7,4)(7,5)(7,6) — (7,7)에 놓으면 6목
        placeStones(board, [
          { row: 7, col: 2, color: "black" },
          { row: 7, col: 3, color: "black" },
          { row: 7, col: 4, color: "black" },
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(true);
      });

      it("7목도 금수이다", () => {
        const board = emptyBoard();
        placeStones(board, [
          { row: 7, col: 1, color: "black" },
          { row: 7, col: 2, color: "black" },
          { row: 7, col: 3, color: "black" },
          { row: 7, col: 4, color: "black" },
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(true);
      });
    });

    describe("사사 금수 (4-4)", () => {
      it("두 방향에서 동시에 사가 만들어지면 금수이다", () => {
        const board = emptyBoard();
        // 가로 사: (7,4)(7,5)(7,6) + (7,7) = 4개, (7,3) 또는 (7,8)에 두면 5목
        // 세로 사: (4,7)(5,7)(6,7) + (7,7) = 4개, (3,7) 또는 (8,7)에 두면 5목
        placeStones(board, [
          { row: 7, col: 4, color: "black" },
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
          { row: 4, col: 7, color: "black" },
          { row: 5, col: 7, color: "black" },
          { row: 6, col: 7, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(true);
      });

      it("사가 1개만 있으면 금수가 아니다", () => {
        const board = emptyBoard();
        // 가로만 사: (7,4)(7,5)(7,6) + (7,7) = 4개
        placeStones(board, [
          { row: 7, col: 4, color: "black" },
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });
    });

    describe("삼삼 금수 (3-3)", () => {
      it("두 방향에서 동시에 활삼이 만들어지면 금수이다", () => {
        const board = emptyBoard();
        // 가로 활삼: _XX?_ (7,5)(7,6) + (7,7) = 3개, 양쪽 끝 (7,4)(7,8) 빈칸
        // 세로 활삼: (5,7)(6,7) + (7,7) = 3개, 양쪽 끝 (4,7)(8,7) 빈칸
        placeStones(board, [
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
          { row: 5, col: 7, color: "black" },
          { row: 6, col: 7, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(true);
      });

      it("한쪽이 막힌 삼은 활삼이 아니므로 금수가 아니다", () => {
        const board = emptyBoard();
        // 가로: 백(7,4) XX? (7,5)(7,6) + (7,7) — 한쪽 막힘 → 활삼 아님
        // 세로: (5,7)(6,7) + (7,7) = 활삼
        placeStones(board, [
          { row: 7, col: 4, color: "white" },
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
          { row: 5, col: 7, color: "black" },
          { row: 6, col: 7, color: "black" },
        ]);
        // 가로는 활삼이 아님, 세로만 활삼 1개 → 삼삼 아님
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });

      it("활삼이 1개만 있으면 금수가 아니다", () => {
        const board = emptyBoard();
        // 세로만 활삼: (5,7)(6,7) + (7,7)
        placeStones(board, [
          { row: 5, col: 7, color: "black" },
          { row: 6, col: 7, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });
    });

    describe("이미 돌이 있는 위치", () => {
      it("이미 돌이 있는 위치는 금수가 아니다 (false 반환)", () => {
        const board = emptyBoard();
        board[7][7] = "black";
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });
    });

    describe("빈 보드", () => {
      it("빈 보드에서는 금수가 없다", () => {
        const board = emptyBoard();
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });
    });

    describe("대각선 금수", () => {
      it("대각선 방향 삼삼 금수", () => {
        const board = emptyBoard();
        // 대각선(↘) 활삼: (5,5)(6,6) + (7,7), 양쪽 끝 (4,4)(8,8) 빈칸
        // 역대각선(↗) 활삼: (5,9)(6,8) + (7,7), 양쪽 끝 (4,10)(8,6) 빈칸
        placeStones(board, [
          { row: 5, col: 5, color: "black" },
          { row: 6, col: 6, color: "black" },
          { row: 5, col: 9, color: "black" },
          { row: 6, col: 8, color: "black" },
        ]);
        expect(isForbiddenMove(board, 7, 7)).toBe(true);
      });
    });

    describe("띈 삼 (split three) 패턴", () => {
      it("X_X 형태의 삼에서 가운데에 놓아도 활삼 판정", () => {
        const board = emptyBoard();
        // 가로: (7,5)_?(7,7) — (7,6)에 놓으면 연속 3
        // 하지만 이 테스트는 (7,7)에 놓는 것이 아니라 특정 패턴 테스트
        // 가로: (7,5)(7,6) + (7,8) — 띈 삼: XX_X
        // 세로: (5,7)(6,7) + (7,7) — 연속 삼
        placeStones(board, [
          { row: 7, col: 5, color: "black" },
          { row: 7, col: 6, color: "black" },
          { row: 7, col: 8, color: "black" },
          { row: 5, col: 7, color: "black" },
          { row: 6, col: 7, color: "black" },
        ]);
        // (7,7)에 놓으면: 가로 XX?X → XXXX (사), 세로 XXX (삼)
        // 사 1개 + 삼 1개 → 사사 아님, 삼삼 아님 → 금수 아님
        expect(isForbiddenMove(board, 7, 7)).toBe(false);
      });
    });
  });

  describe("getForbiddenMoves", () => {
    it("빈 보드에서는 금수 위치가 없다", () => {
      const board = emptyBoard();
      const forbidden = getForbiddenMoves(board);
      expect(forbidden).toEqual([]);
    });

    it("삼삼 금수 위치를 반환한다", () => {
      const board = emptyBoard();
      placeStones(board, [
        { row: 7, col: 5, color: "black" },
        { row: 7, col: 6, color: "black" },
        { row: 5, col: 7, color: "black" },
        { row: 6, col: 7, color: "black" },
      ]);
      const forbidden = getForbiddenMoves(board);
      expect(forbidden).toContainEqual({ row: 7, col: 7 });
    });

    it("사사 금수 위치를 반환한다", () => {
      const board = emptyBoard();
      placeStones(board, [
        { row: 7, col: 4, color: "black" },
        { row: 7, col: 5, color: "black" },
        { row: 7, col: 6, color: "black" },
        { row: 4, col: 7, color: "black" },
        { row: 5, col: 7, color: "black" },
        { row: 6, col: 7, color: "black" },
      ]);
      const forbidden = getForbiddenMoves(board);
      expect(forbidden).toContainEqual({ row: 7, col: 7 });
    });

    it("장목 금수 위치를 반환한다", () => {
      const board = emptyBoard();
      placeStones(board, [
        { row: 7, col: 2, color: "black" },
        { row: 7, col: 3, color: "black" },
        { row: 7, col: 4, color: "black" },
        { row: 7, col: 5, color: "black" },
        { row: 7, col: 6, color: "black" },
      ]);
      // (7,1) and (7,7) would create 6+ → overline forbidden
      const forbidden = getForbiddenMoves(board);
      expect(forbidden).toContainEqual({ row: 7, col: 7 });
      expect(forbidden).toContainEqual({ row: 7, col: 1 });
    });
  });
});
