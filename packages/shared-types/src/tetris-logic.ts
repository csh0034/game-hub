import type { TetrominoType, TetrisActivePiece } from "./game-types";

export const BOARD_ROWS = 20;
export const BOARD_COLS = 10;

export const TETROMINO_SHAPES: Record<TetrominoType, [number, number][][]> = {
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

export type TetrisBoard = (TetrominoType | null)[][];

export function isValidPosition(board: TetrisBoard, piece: TetrisActivePiece): boolean {
  const cells = TETROMINO_SHAPES[piece.type][piece.rotation];
  for (const [dr, dc] of cells) {
    const r = piece.row + dr;
    const c = piece.col + dc;
    if (r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
    // Cells above the board (r < 0) are valid — empty space above visible area
    if (r >= 0 && board[r][c] !== null) return false;
  }
  return true;
}

export function tryMove(
  board: TetrisBoard,
  piece: TetrisActivePiece,
  dRow: number,
  dCol: number,
): TetrisActivePiece | null {
  const moved: TetrisActivePiece = {
    ...piece,
    row: piece.row + dRow,
    col: piece.col + dCol,
  };
  return isValidPosition(board, moved) ? moved : null;
}

export function tryRotate(
  board: TetrisBoard,
  piece: TetrisActivePiece,
  direction: 1 | -1,
): TetrisActivePiece | null {
  if (piece.type === "O") return piece;

  const fromRot = piece.rotation;
  const toRot = ((fromRot + direction + 4) % 4) as 0 | 1 | 2 | 3;
  const key = `${fromRot}>${toRot}`;

  const offsets = piece.type === "I" ? SRS_OFFSETS_I[key] : SRS_OFFSETS_JLSTZ[key];
  if (!offsets) return null;

  for (const [dx, dy] of offsets) {
    const rotated: TetrisActivePiece = {
      ...piece,
      rotation: toRot,
      col: piece.col + dx,
      row: piece.row + dy,
    };
    if (isValidPosition(board, rotated)) {
      return rotated;
    }
  }
  return null;
}

export function calculateGhostRow(board: TetrisBoard, piece: TetrisActivePiece): number {
  let ghostRow = piece.row;
  const ghost: TetrisActivePiece = { ...piece };
  while (true) {
    ghost.row = ghostRow + 1;
    if (!isValidPosition(board, ghost)) break;
    ghostRow++;
  }
  return ghostRow;
}

export function getPieceCells(piece: TetrisActivePiece): [number, number][] {
  return TETROMINO_SHAPES[piece.type][piece.rotation].map(([dr, dc]) => [
    piece.row + dr,
    piece.col + dc,
  ]);
}
