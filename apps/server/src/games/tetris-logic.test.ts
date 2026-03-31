import { describe, it, expect } from "vitest";
import {
  isValidPosition,
  tryMove,
  tryRotate,
  calculateGhostRow,
  getPieceCells,
  BOARD_ROWS,
  BOARD_COLS,
} from "@game-hub/shared-types";
import type { TetrisActivePiece, TetrominoType } from "@game-hub/shared-types";

function createEmptyBoard(): (TetrominoType | null)[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null),
  );
}

describe("tetris-logic", () => {
  describe("isValidPosition", () => {
    it("빈 보드에서 유효한 위치를 허용한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "T", row: 5, col: 5, rotation: 0 };
      expect(isValidPosition(board, piece)).toBe(true);
    });

    it("보드 하단 밖은 거부한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "T", row: BOARD_ROWS, col: 5, rotation: 0 };
      expect(isValidPosition(board, piece)).toBe(false);
    });

    it("보드 좌측 밖은 거부한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "T", row: 5, col: -1, rotation: 0 };
      expect(isValidPosition(board, piece)).toBe(false);
    });

    it("보드 우측 밖은 거부한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "I", row: 5, col: BOARD_COLS - 1, rotation: 0 };
      expect(isValidPosition(board, piece)).toBe(false);
    });

    it("기존 블록과 겹치면 거부한다", () => {
      const board = createEmptyBoard();
      board[5][5] = "T";
      const piece: TetrisActivePiece = { type: "T", row: 5, col: 5, rotation: 0 };
      expect(isValidPosition(board, piece)).toBe(false);
    });

    it("row가 음수인 셀은 유효로 처리한다 (보드 위 빈 공간)", () => {
      const board = createEmptyBoard();
      // T피스 row=0, 오프셋 [-1,0]은 r=-1 → 유효해야 함
      const piece: TetrisActivePiece = { type: "T", row: 0, col: 5, rotation: 0 };
      expect(isValidPosition(board, piece)).toBe(true);
    });
  });

  describe("tryMove", () => {
    it("유효한 이동은 새 피스를 반환한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "T", row: 5, col: 5, rotation: 0 };
      const moved = tryMove(board, piece, 0, -1);
      expect(moved).not.toBeNull();
      expect(moved!.col).toBe(4);
      expect(moved!.row).toBe(5);
    });

    it("유효하지 않은 이동은 null을 반환한다", () => {
      const board = createEmptyBoard();
      // T피스는 col+오프셋 [-1]이 있으므로 col=0이면 왼쪽 이동 불가
      const piece: TetrisActivePiece = { type: "T", row: 5, col: 0, rotation: 0 };
      const moved = tryMove(board, piece, 0, -1);
      expect(moved).toBeNull();
    });

    it("아래로 이동할 수 있다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "O", row: 5, col: 5, rotation: 0 };
      const moved = tryMove(board, piece, 1, 0);
      expect(moved).not.toBeNull();
      expect(moved!.row).toBe(6);
    });

    it("바닥에서 아래로 이동할 수 없다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "O", row: BOARD_ROWS - 2, col: 5, rotation: 0 };
      const moved = tryMove(board, piece, 1, 0);
      expect(moved).toBeNull();
    });
  });

  describe("tryRotate", () => {
    it("시계 방향 회전이 동작한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "T", row: 10, col: 5, rotation: 0 };
      const rotated = tryRotate(board, piece, 1);
      expect(rotated).not.toBeNull();
      expect(rotated!.rotation).toBe(1);
    });

    it("반시계 방향 회전이 동작한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "T", row: 10, col: 5, rotation: 0 };
      const rotated = tryRotate(board, piece, -1);
      expect(rotated).not.toBeNull();
      expect(rotated!.rotation).toBe(3);
    });

    it("O피스는 회전해도 같은 피스를 반환한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "O", row: 10, col: 5, rotation: 0 };
      const rotated = tryRotate(board, piece, 1);
      expect(rotated).not.toBeNull();
      expect(rotated!.rotation).toBe(0);
    });

    it("SRS 벽차기가 적용된다", () => {
      const board = createEmptyBoard();
      // 벽에 붙어있을 때 회전 시 벽차기로 밀려남
      const piece: TetrisActivePiece = { type: "T", row: 10, col: 0, rotation: 2 };
      const rotated = tryRotate(board, piece, 1);
      // 벽차기로 회전이 성공해야 함
      expect(rotated).not.toBeNull();
    });

    it("Z피스가 오른쪽 벽에서 시계 방향 회전된다 (0→1)", () => {
      const board = createEmptyBoard();
      // Z피스 rotation 0: rightmost cell = col+1, col=8이면 col+1=9 (보드 끝)
      const piece: TetrisActivePiece = { type: "Z", row: 10, col: 8, rotation: 0 };
      const rotated = tryRotate(board, piece, 1);
      expect(rotated).not.toBeNull();
      expect(rotated!.rotation).toBe(1);
    });

    it("Z피스가 오른쪽 벽에서 4단계 연속 회전된다", () => {
      const board = createEmptyBoard();
      // Z피스 시계 방향 4회 회전: 0→1→2→3→0
      let piece: TetrisActivePiece = { type: "Z", row: 10, col: 8, rotation: 0 };
      for (let i = 0; i < 4; i++) {
        const rotated = tryRotate(board, piece, 1);
        expect(rotated).not.toBeNull();
        piece = rotated!;
      }
      expect(piece.rotation).toBe(0);
    });

    it("S피스가 왼쪽 벽에서 4단계 연속 회전된다", () => {
      const board = createEmptyBoard();
      let piece: TetrisActivePiece = { type: "S", row: 10, col: 1, rotation: 0 };
      for (let i = 0; i < 4; i++) {
        const rotated = tryRotate(board, piece, 1);
        expect(rotated).not.toBeNull();
        piece = rotated!;
      }
      expect(piece.rotation).toBe(0);
    });

    it("I피스가 오른쪽 벽에서 회전된다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "I", row: 10, col: 8, rotation: 0 };
      const rotated = tryRotate(board, piece, 1);
      expect(rotated).not.toBeNull();
    });
  });

  describe("calculateGhostRow", () => {
    it("빈 보드에서 고스트는 바닥에 위치한다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "O", row: 0, col: 5, rotation: 0 };
      const ghostRow = calculateGhostRow(board, piece);
      expect(ghostRow).toBe(BOARD_ROWS - 2); // O피스는 2행 차지
    });

    it("블록 위에 고스트가 위치한다", () => {
      const board = createEmptyBoard();
      // 15행에 블록 배치
      for (let c = 0; c < BOARD_COLS; c++) {
        board[15][c] = "Z";
      }
      const piece: TetrisActivePiece = { type: "O", row: 0, col: 5, rotation: 0 };
      const ghostRow = calculateGhostRow(board, piece);
      expect(ghostRow).toBe(13); // O피스는 row+1까지 차지하므로 13에서 멈춤
    });

    it("고스트 row가 항상 피스 위치 이상이다", () => {
      const board = createEmptyBoard();
      const piece: TetrisActivePiece = { type: "T", row: 10, col: 5, rotation: 0 };
      const ghostRow = calculateGhostRow(board, piece);
      expect(ghostRow).toBeGreaterThanOrEqual(piece.row);
    });
  });

  describe("getPieceCells", () => {
    it("T피스의 셀 위치를 반환한다", () => {
      const piece: TetrisActivePiece = { type: "T", row: 5, col: 5, rotation: 0 };
      const cells = getPieceCells(piece);
      expect(cells).toHaveLength(4);
      // T피스 rotation=0: [0,-1],[0,0],[0,1],[-1,0] → [5,4],[5,5],[5,6],[4,5]
      expect(cells).toContainEqual([5, 4]);
      expect(cells).toContainEqual([5, 5]);
      expect(cells).toContainEqual([5, 6]);
      expect(cells).toContainEqual([4, 5]);
    });

    it("O피스의 셀 위치를 반환한다", () => {
      const piece: TetrisActivePiece = { type: "O", row: 0, col: 0, rotation: 0 };
      const cells = getPieceCells(piece);
      expect(cells).toHaveLength(4);
      expect(cells).toContainEqual([0, 0]);
      expect(cells).toContainEqual([0, 1]);
      expect(cells).toContainEqual([1, 0]);
      expect(cells).toContainEqual([1, 1]);
    });
  });
});
