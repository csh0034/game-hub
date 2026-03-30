import type { StoneColor } from "@game-hub/shared-types";

type Board = (StoneColor | null)[][];
type Pos = { row: number; col: number };

const SIZE = 15;
const DIRECTIONS: [number, number][] = [
  [0, 1],  // horizontal
  [1, 0],  // vertical
  [1, 1],  // diagonal
  [1, -1], // anti-diagonal
];

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

/**
 * Count consecutive stones of `color` starting from (row,col) in direction (dr,dc),
 * NOT including (row,col) itself.
 */
function countDir(board: Board, row: number, col: number, dr: number, dc: number, color: StoneColor): number {
  let count = 0;
  for (let i = 1; i < SIZE; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (!inBounds(r, c) || board[r][c] !== color) break;
    count++;
  }
  return count;
}

/**
 * Get the cell value at offset `dist` from (row,col) in direction (dr,dc).
 * Returns "wall" if out of bounds.
 */
function getCell(board: Board, row: number, col: number, dr: number, dc: number, dist: number): StoneColor | null | "wall" {
  const r = row + dr * dist;
  const c = col + dc * dist;
  if (!inBounds(r, c)) return "wall";
  return board[r][c];
}

/**
 * Extract a line of cells centered on (row,col) in one direction.
 * Returns an array of cell values from -range to +range (2*range+1 elements).
 * Index `range` is the center (row,col).
 */
function extractLine(board: Board, row: number, col: number, dr: number, dc: number, range: number): (StoneColor | null | "wall")[] {
  const line: (StoneColor | null | "wall")[] = [];
  for (let i = -range; i <= range; i++) {
    line.push(getCell(board, row, col, dr, dc, i));
  }
  return line;
}

/**
 * Check if placing black at (row,col) creates exactly 5 in a row in any direction.
 * Board should already have the stone placed.
 */
function hasExactFive(board: Board, row: number, col: number, color: StoneColor): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const forward = countDir(board, row, col, dr, dc, color);
    const backward = countDir(board, row, col, -dr, -dc, color);
    if (forward + backward + 1 === 5) return true;
  }
  return false;
}

/**
 * Check if placing at (row,col) creates 6 or more in a row (overline).
 * Board should already have the stone placed.
 */
function hasOverline(board: Board, row: number, col: number, color: StoneColor): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const forward = countDir(board, row, col, dr, dc, color);
    const backward = countDir(board, row, col, -dr, -dc, color);
    if (forward + backward + 1 >= 6) return true;
  }
  return false;
}

/**
 * Count the number of "fours" created by placing black at (row,col) in all directions.
 * A "four" is a pattern where one more stone would make exactly 5 in a row.
 * Board should already have the stone placed.
 */
function countFours(board: Board, row: number, col: number): number {
  let fourCount = 0;
  const color: StoneColor = "black";

  for (const [dr, dc] of DIRECTIONS) {
    const fours = countFoursInDirection(board, row, col, dr, dc, color);
    fourCount += fours;
  }
  return fourCount;
}

/**
 * Count fours in a specific direction for the placed stone at (row,col).
 * A four means: if we place one more black stone somewhere in this line, we get exactly 5.
 * We look at the line pattern and find how many empty spots, when filled, create exactly 5.
 */
function countFoursInDirection(board: Board, row: number, col: number, dr: number, dc: number, color: StoneColor): number {
  // Extract line centered on (row,col), range 5 in each direction
  const line = extractLine(board, row, col, dr, dc, 5);
  const center = 5; // index of (row,col) in the line

  // Find all contiguous groups that include the center stone
  // A "four" = exactly 4 stones of `color` in a window of 5 consecutive cells,
  // with exactly 1 empty cell (no opponent/wall), and filling that empty creates exactly 5 (not 6+).
  let fours = 0;

  // Check all windows of size 5 that include the center
  for (let start = Math.max(0, center - 4); start <= Math.min(line.length - 5, center); start++) {
    const window = line.slice(start, start + 5);
    let colorCount = 0;
    let emptyCount = 0;
    let emptyIdx = -1;

    for (let i = 0; i < 5; i++) {
      if (window[i] === color) colorCount++;
      else if (window[i] === null) { emptyCount++; emptyIdx = i; }
    }

    if (colorCount === 4 && emptyCount === 1) {
      // Check that filling the empty doesn't create overline (6+)
      const emptyAbsIdx = start + emptyIdx;
      const emptyR = row + dr * (emptyAbsIdx - center);
      const emptyC = col + dc * (emptyAbsIdx - center);

      if (inBounds(emptyR, emptyC)) {
        // Temporarily place to check for overline
        board[emptyR][emptyC] = color;
        const wouldBeExactFive = hasExactFiveInDirection(board, emptyR, emptyC, dr, dc, color);
        board[emptyR][emptyC] = null;

        if (wouldBeExactFive) {
          fours++;
        }
      }
    }
  }

  // Deduplicate: a single direction can have at most 1 four from the placed stone's perspective
  return Math.min(fours, 1);
}

/**
 * Check if there's exactly 5 in a row in a specific direction at (row,col).
 */
function hasExactFiveInDirection(board: Board, row: number, col: number, dr: number, dc: number, color: StoneColor): boolean {
  const forward = countDir(board, row, col, dr, dc, color);
  const backward = countDir(board, row, col, -dr, -dc, color);
  return forward + backward + 1 === 5;
}

/**
 * Count the number of "open threes" created by placing black at (row,col).
 * An open three is a three that can become an open four (_XXXX_) with one move.
 * Board should already have the stone placed.
 *
 * recursionDepth limits recursive forbidden check to prevent infinite loops.
 */
function countOpenThrees(board: Board, row: number, col: number, recursionDepth: number): number {
  let threeCount = 0;
  const color: StoneColor = "black";

  for (const [dr, dc] of DIRECTIONS) {
    if (isOpenThreeInDirection(board, row, col, dr, dc, color, recursionDepth)) {
      threeCount++;
    }
  }
  return threeCount;
}

/**
 * Check if there's an open three in a specific direction at (row,col).
 * An open three: a group of 3 stones where placing one more creates an open four (_XXXX_).
 * An open four: exactly 4 consecutive same-color stones with both ends empty.
 */
function isOpenThreeInDirection(
  board: Board, row: number, col: number,
  dr: number, dc: number, color: StoneColor,
  recursionDepth: number,
): boolean {
  const line = extractLine(board, row, col, dr, dc, 5);
  const center = 5;

  // Look for windows of size 6: _XXXX_ pattern potential
  // An open three means: in this direction, there's a pattern of 3 stones + 1 empty
  // within a window, and filling that empty creates an open four.

  // Strategy: find all empty spots in this direction where placing a stone creates an open four.
  // If such a spot exists and is not itself a forbidden move, this is an open three.

  // Check windows of 4 cells that include the center
  for (let start = Math.max(0, center - 3); start <= Math.min(line.length - 4, center); start++) {
    const window = line.slice(start, start + 4);
    let colorCount = 0;
    let emptyCount = 0;
    let emptyIdxInWindow = -1;

    for (let i = 0; i < 4; i++) {
      if (window[i] === color) colorCount++;
      else if (window[i] === null) { emptyCount++; emptyIdxInWindow = i; }
    }

    if (colorCount === 3 && emptyCount === 1) {
      // Check if both ends of the 4-cell window are empty (making it potentially an open four)
      const beforeIdx = start - 1;
      const afterIdx = start + 4;
      const before = beforeIdx >= 0 && beforeIdx < line.length ? line[beforeIdx] : "wall";
      const after = afterIdx >= 0 && afterIdx < line.length ? line[afterIdx] : "wall";

      if (before === null && after === null) {
        // Filling the empty cell in the window would create _XXXX_ (open four)
        // But we need to verify it creates exactly an open four (not overline)
        const emptyAbsIdx = start + emptyIdxInWindow;
        const emptyR = row + dr * (emptyAbsIdx - center);
        const emptyC = col + dc * (emptyAbsIdx - center);

        if (inBounds(emptyR, emptyC)) {
          // Check the fill move doesn't create overline
          board[emptyR][emptyC] = color;
          const lineLen = countDir(board, emptyR, emptyC, dr, dc, color) +
                          countDir(board, emptyR, emptyC, -dr, -dc, color) + 1;
          board[emptyR][emptyC] = null;

          if (lineLen === 4) {
            // Verify the completing move is not itself forbidden (recursive check)
            if (recursionDepth > 0) {
              board[emptyR][emptyC] = color;
              const fillIsForbidden = isForbiddenMoveInternal(board, emptyR, emptyC, recursionDepth - 1);
              board[emptyR][emptyC] = null;
              if (!fillIsForbidden) return true;
            } else {
              return true;
            }
          }
        }
      }
    }
  }

  // Also check for "split three" patterns: X_X_X type within a 6-cell window
  // where the center stone is part of it and filling one gap creates open four
  for (let start = Math.max(0, center - 4); start <= Math.min(line.length - 5, center); start++) {
    const window = line.slice(start, start + 5);
    let colorCount = 0;
    let emptyCount = 0;
    const emptyPositions: number[] = [];

    for (let i = 0; i < 5; i++) {
      if (window[i] === color) colorCount++;
      else if (window[i] === null) { emptyCount++; emptyPositions.push(i); }
    }

    // 3 stones + 2 empties in a window of 5
    if (colorCount === 3 && emptyCount === 2) {
      // For each empty position, check if filling it creates a pattern that leads to open four
      for (const emptyPos of emptyPositions) {
        const emptyAbsIdx = start + emptyPos;
        const emptyR = row + dr * (emptyAbsIdx - center);
        const emptyC = col + dc * (emptyAbsIdx - center);

        if (!inBounds(emptyR, emptyC)) continue;

        board[emptyR][emptyC] = color;

        // After filling, check if this creates an open four in this direction
        const lineLen = countDir(board, emptyR, emptyC, dr, dc, color) +
                        countDir(board, emptyR, emptyC, -dr, -dc, color) + 1;

        if (lineLen === 4) {
          // Check both ends of this 4-line are empty
          const fwd = countDir(board, emptyR, emptyC, dr, dc, color);
          const bwd = countDir(board, emptyR, emptyC, -dr, -dc, color);
          const endFwdR = emptyR + dr * (fwd + 1);
          const endFwdC = emptyC + dc * (fwd + 1);
          const endBwdR = emptyR - dr * (bwd + 1);
          const endBwdC = emptyC - dc * (bwd + 1);

          const fwdOpen = inBounds(endFwdR, endFwdC) && board[endFwdR][endFwdC] === null;
          const bwdOpen = inBounds(endBwdR, endBwdC) && board[endBwdR][endBwdC] === null;

          if (fwdOpen && bwdOpen) {
            if (recursionDepth > 0) {
              const fillIsForbidden = isForbiddenMoveInternal(board, emptyR, emptyC, recursionDepth - 1);
              board[emptyR][emptyC] = null;
              if (!fillIsForbidden) return true;
            } else {
              board[emptyR][emptyC] = null;
              return true;
            }
          } else {
            board[emptyR][emptyC] = null;
          }
        } else {
          board[emptyR][emptyC] = null;
        }
      }
    }
  }

  return false;
}

/**
 * Internal forbidden move check with recursion depth control.
 * Board should already have the stone placed at (row,col).
 */
function isForbiddenMoveInternal(board: Board, row: number, col: number, recursionDepth: number): boolean {
  // Exact five is never forbidden
  if (hasExactFive(board, row, col, "black")) return false;

  // Overline (6+) is forbidden
  if (hasOverline(board, row, col, "black")) return true;

  // Double four (4-4) is forbidden
  if (countFours(board, row, col) >= 2) return true;

  // Double three (3-3) is forbidden
  if (countOpenThrees(board, row, col, recursionDepth) >= 2) return true;

  return false;
}

/**
 * Check if placing black at (row,col) is a forbidden move under Renju rules.
 * The board should NOT have the stone placed yet.
 */
export function isForbiddenMove(board: Board, row: number, col: number): boolean {
  if (board[row][col] !== null) return false;

  // Place stone temporarily
  board[row][col] = "black";
  const result = isForbiddenMoveInternal(board, row, col, 1);
  board[row][col] = null;

  return result;
}

/**
 * Get all forbidden move positions for black on the current board.
 */
export function getForbiddenMoves(board: Board): Pos[] {
  const forbidden: Pos[] = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col] === null && isForbiddenMove(board, row, col)) {
        forbidden.push({ row, col });
      }
    }
  }
  return forbidden;
}
