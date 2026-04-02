"use client";

import { useEffect, useRef, useState, memo } from "react";
import { SPEED_RACE_TARGET_LINES } from "@game-hub/shared-types";
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

function getSpeedRaceProgressColor(linesCleared: number) {
  const remaining = SPEED_RACE_TARGET_LINES - linesCleared;
  if (remaining <= 5) return { text: "text-green-400", bar: "bg-gradient-to-r from-green-400 to-emerald-300", glow: true };
  if (remaining <= 10) return { text: "text-green-400", bar: "bg-gradient-to-r from-neon-yellow to-green-400", glow: false };
  if (remaining <= 20) return { text: "text-neon-yellow", bar: "bg-gradient-to-r from-primary to-neon-yellow", glow: false };
  return { text: "text-primary", bar: "bg-gradient-to-r from-primary to-neon-purple", glow: false };
}

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
  isSpeedRace?: boolean;
  elapsedTime?: number;
}

export const OpponentCanvas = memo(function OpponentCanvas({
  board,
  cellSize,
  nickname,
  isSpeedRace,
  elapsedTime,
}: OpponentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = BOARD_COLS * cellSize;
  const height = BOARD_ROWS * cellSize;

  const prevLinesClearedRef = useRef(board.linesCleared);
  const [isPulsing, setIsPulsing] = useState(false);
  const remaining = SPEED_RACE_TARGET_LINES - board.linesCleared;
  const progressColors = getSpeedRaceProgressColor(board.linesCleared);

  useEffect(() => {
    if (isSpeedRace && board.linesCleared !== prevLinesClearedRef.current && board.linesCleared > 0) {
      const startTimer = setTimeout(() => setIsPulsing(true), 0);
      const endTimer = setTimeout(() => setIsPulsing(false), 300);
      prevLinesClearedRef.current = board.linesCleared;
      return () => { clearTimeout(startTimer); clearTimeout(endTimer); };
    }
    prevLinesClearedRef.current = board.linesCleared;
  }, [board.linesCleared, isSpeedRace]);

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

  const isGameOver = board.status === "gameover";

  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors ${
      isGameOver
        ? "border-muted/30 bg-muted/10 opacity-70"
        : "border-primary/20 bg-secondary/20 shadow-[0_0_8px_rgba(34,211,238,0.08)]"
    }`}>
      {nickname && (
        <span className={`text-[11px] font-display font-medium tracking-wide ${
          isGameOver ? "text-muted-foreground" : "text-primary"
        }`}>{nickname}</span>
      )}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded border border-border/50"
        />
        {board.pendingGarbage > 0 && (
          <div className="absolute top-0.5 right-0.5 text-[8px] font-bold text-red-400 bg-black/60 rounded px-1">
            {board.pendingGarbage}
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 w-full">
        {isSpeedRace && (
          <div className="w-full bg-black/40 rounded-full h-1.5 border border-primary/10">
            <div
              className={`${progressColors.bar} h-full rounded-full transition-all duration-300 ${progressColors.glow ? "shadow-[0_0_6px_rgba(74,222,128,0.5)]" : ""}`}
              style={{ width: `${Math.min((board.linesCleared / SPEED_RACE_TARGET_LINES) * 100, 100)}%` }}
            />
          </div>
        )}
        <div className="flex items-center justify-center gap-2 text-[10px] font-mono">
        {isSpeedRace ? (
          <>
            <span className={`font-bold transition-transform duration-200 inline-block ${isPulsing ? "scale-125" : "scale-100"} ${progressColors.text}`}>{remaining} left</span>
            <span className="text-muted-foreground">{board.linesCleared}/{SPEED_RACE_TARGET_LINES}</span>
            {elapsedTime != null && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{(elapsedTime / 1000).toFixed(3)}초</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="text-primary">L{board.level}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{board.score.toLocaleString()}</span>
            {elapsedTime != null && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{(elapsedTime / 1000).toFixed(3)}초</span>
              </>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.cellSize !== next.cellSize) return false;
  if (prev.nickname !== next.nickname) return false;
  if (prev.isSpeedRace !== next.isSpeedRace) return false;
  if (prev.elapsedTime !== next.elapsedTime) return false;
  return prev.board.version === next.board.version;
});
