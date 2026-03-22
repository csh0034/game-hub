"use client";

import { useEffect, useRef, memo } from "react";
import type { TetrisPlayerBoard, TetrominoType, TetrisActivePiece } from "@game-hub/shared-types";

const TETROMINO_HEX: Record<TetrominoType, string> = {
  I: "#22d3ee", // cyan-400
  O: "#facc15", // yellow-400
  T: "#a855f7", // purple-500
  S: "#22c55e", // green-500
  Z: "#ef4444", // red-500
  J: "#2563eb", // blue-600
  L: "#f97316", // orange-500
};

const GARBAGE_COLOR = "#71717a"; // zinc-500
const EMPTY_COLOR = "rgba(0, 0, 0, 0.15)";
const GRID_COLOR = "rgba(128, 128, 128, 0.15)";

const BOARD_ROWS = 20;
const BOARD_COLS = 10;

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

function getPieceCells(piece: TetrisActivePiece): [number, number][] {
  return TETROMINO_SHAPES[piece.type][piece.rotation].map(([dr, dc]) => [
    piece.row + dr,
    piece.col + dc,
  ]);
}

interface OpponentCanvasProps {
  board: TetrisPlayerBoard;
  cellSize: number;
  nickname?: string;
}

export const OpponentCanvas = memo(function OpponentCanvas({
  board,
  cellSize,
  nickname,
}: OpponentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = BOARD_COLS * cellSize;
  const height = BOARD_ROWS * cellSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw board cells
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const cell = board.board[r]?.[c];
        const x = c * cellSize;
        const y = r * cellSize;

        if (cell) {
          ctx.fillStyle = TETROMINO_HEX[cell];
          ctx.fillRect(x, y, cellSize, cellSize);
        } else {
          ctx.fillStyle = EMPTY_COLOR;
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Grid lines
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }
    }

    // Draw active piece
    if (board.activePiece) {
      const cells = getPieceCells(board.activePiece);
      ctx.fillStyle = TETROMINO_HEX[board.activePiece.type];
      for (const [r, c] of cells) {
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw game over overlay
    if (board.status === "gameover") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(cellSize, 8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", width / 2, height / 2);
    }
  }, [board.board, board.activePiece, board.version, board.status, cellSize, width, height]);

  return (
    <div className="flex flex-col items-center gap-1">
      {nickname && (
        <span className="text-[10px] text-muted-foreground font-medium">{nickname}</span>
      )}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border border-border rounded bg-secondary/30"
        />
        {board.pendingGarbage > 0 && (
          <div className="absolute top-0.5 right-0.5 text-[8px] font-bold text-red-400 bg-black/50 rounded px-0.5">
            {board.pendingGarbage}
          </div>
        )}
      </div>
      <div className="text-center space-y-0">
        <div className="text-[10px] text-muted-foreground">
          L{board.level} · {board.score.toLocaleString()}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.cellSize !== next.cellSize) return false;
  if (prev.nickname !== next.nickname) return false;
  return prev.board.version === next.board.version;
});
