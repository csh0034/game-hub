"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type { MinesweeperPublicState, MinesweeperMove, MinesweeperDifficulty } from "@game-hub/shared-types";
import { MINESWEEPER_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { useGameStore } from "@/stores/game-store";

const NUMBER_COLORS: Record<number, string> = {
  1: "text-blue-600",
  2: "text-green-600",
  3: "text-red-600",
  4: "text-indigo-800",
  5: "text-amber-800",
  6: "text-teal-600",
  7: "text-gray-900",
  8: "text-gray-500",
};

const CELL_SIZES: Record<MinesweeperDifficulty, number> = {
  beginner: 36,
  intermediate: 30,
  expert: 26,
};

export default function MinesweeperBoard({ isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, makeMove } = useGame(socket);
  const gameResult = useGameStore((s) => s.gameResult);
  const [elapsed, setElapsed] = useState(0);

  const state = gameState as MinesweeperPublicState | null;

  useEffect(() => {
    if (!state?.startedAt || state.status !== "playing") return;

    const update = () => setElapsed(Math.floor((Date.now() - state.startedAt!) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [state?.startedAt, state?.status]);

  const handleReveal = useCallback(
    (row: number, col: number) => {
      if (isSpectating) return;
      if (!state || state.status !== "playing") return;
      if (state.board[row][col].status !== "hidden") return;
      const move: MinesweeperMove = { type: "reveal", row, col };
      makeMove(move);
    },
    [isSpectating, state, makeMove],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      if (isSpectating) return;
      if (!state || state.status !== "playing") return;
      const cell = state.board[row][col];
      if (cell.status === "revealed") return;

      let moveType: MinesweeperMove["type"];
      if (cell.status === "hidden") {
        moveType = "flag";
      } else if (cell.status === "flagged") {
        moveType = "question";
      } else if (cell.status === "questioned") {
        moveType = "unquestion";
      } else {
        return;
      }

      makeMove({ type: moveType, row, col });
    },
    [isSpectating, state, makeMove],
  );

  const handleChord = useCallback(
    (row: number, col: number) => {
      if (isSpectating) return;
      if (!state || state.status !== "playing") return;
      const cell = state.board[row][col];
      if (cell.status !== "revealed" || !cell.adjacentMines) return;
      makeMove({ type: "chord", row, col });
    },
    [isSpectating, state, makeMove],
  );

  const leftDownRef = useRef(false);
  const rightDownRef = useRef(false);
  const [pressedCells, setPressedCells] = useState<Set<string>>(new Set());

  const getChordNeighbors = useCallback(
    (row: number, col: number): Set<string> => {
      if (!state || state.status !== "playing") return new Set();
      const cell = state.board[row][col];
      if (cell.status !== "revealed" || !cell.adjacentMines) return new Set();

      const result = new Set<string>();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
            const s = state.board[nr][nc].status;
            if (s === "hidden" || s === "questioned") {
              result.add(`${nr},${nc}`);
            }
          }
        }
      }
      return result;
    },
    [state],
  );

  if (!state) return null;

  const remainingMines = state.mineCount - state.flagCount;
  const cellSize = CELL_SIZES[state.difficulty] ?? 36;
  const difficultyConfig = MINESWEEPER_DIFFICULTY_CONFIGS[state.difficulty];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Difficulty label */}
      <div className="text-sm text-muted-foreground">
        {difficultyConfig.label} ({state.rows}×{state.cols} · 💣{state.mineCount})
      </div>

      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-sm px-2">
        <div className="flex items-center gap-1.5 text-lg font-mono font-bold bg-gray-900 text-red-500 px-3 py-1 rounded">
          <span className="text-base">🚩</span>
          {String(remainingMines).padStart(3, "0")}
        </div>
        <div />
        <div className="flex items-center gap-1.5 text-lg font-mono font-bold bg-gray-900 text-red-500 px-3 py-1 rounded">
          <span className="text-base">⏱</span>
          {String(elapsed).padStart(3, "0")}
        </div>
      </div>

      {/* Board */}
      {/* Board */}
      <div
        className="relative grid border-2 border-gray-400 bg-gray-300"
        style={{
          gridTemplateColumns: `repeat(${state.cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${state.rows}, ${cellSize}px)`,
        }}
        onMouseLeave={() => {
          setPressedCells(new Set());
          leftDownRef.current = false;
          rightDownRef.current = false;
        }}
      >
        {state.board.map((row, r) =>
          row.map((cell, c) => {
            const isPressed = pressedCells.has(`${r},${c}`);
            return (
            <button
              key={`${r}-${c}`}
              className={`flex items-center justify-center border font-bold select-none ${
                cell.status === "revealed"
                  ? "bg-gray-200 border-gray-300"
                  : isPressed
                    ? "bg-gray-300 border-gray-300"
                    : "bg-gray-400 border-t-gray-200 border-l-gray-200 border-r-gray-500 border-b-gray-500 hover:bg-gray-350 active:bg-gray-300"
              }`}
              style={{ width: cellSize, height: cellSize, fontSize: cellSize > 30 ? 14 : 11 }}
              onMouseDown={(e) => {
                if (e.button === 0) leftDownRef.current = true;
                if (e.button === 2) rightDownRef.current = true;
                if (e.button === 1) {
                  e.preventDefault();
                  handleChord(r, c);
                }
                if (leftDownRef.current && rightDownRef.current) {
                  setPressedCells(getChordNeighbors(r, c));
                }
              }}
              onMouseUp={(e) => {
                const wasLeft = leftDownRef.current;
                const wasRight = rightDownRef.current;
                if (e.button === 0) leftDownRef.current = false;
                if (e.button === 2) rightDownRef.current = false;

                setPressedCells(new Set());

                if ((e.button === 0 && wasRight) || (e.button === 2 && wasLeft)) {
                  handleChord(r, c);
                  return;
                }

                if (e.button === 0 && !wasRight) {
                  handleReveal(r, c);
                }
              }}
              onMouseEnter={() => {
                if (leftDownRef.current && rightDownRef.current) {
                  setPressedCells(getChordNeighbors(r, c));
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (leftDownRef.current) return;
                handleContextMenu(e, r, c);
              }}
              disabled={state.status !== "playing"}
            >
              {cell.status === "flagged" && <span style={{ fontSize: cellSize > 30 ? 16 : 12 }}>🚩</span>}
              {cell.status === "questioned" && <span style={{ fontSize: cellSize > 30 ? 16 : 12 }}>❓</span>}
              {cell.status === "revealed" && cell.hasMine && <span style={{ fontSize: cellSize > 30 ? 16 : 12 }}>💣</span>}
              {cell.status === "revealed" && !cell.hasMine && cell.adjacentMines !== undefined && cell.adjacentMines > 0 && (
                <span className={NUMBER_COLORS[cell.adjacentMines]}>{cell.adjacentMines}</span>
              )}
              {cell.status === "hidden" && cell.hasMine && <span style={{ fontSize: cellSize > 30 ? 16 : 12 }}>💣</span>}
            </button>
            );
          }),
        )}

        {/* Game result overlay */}
        {state.status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded gap-2">
            <span className={`text-3xl font-bold drop-shadow-lg ${state.status === "won" ? "text-yellow-400" : "text-red-400"}`}>
              {state.status === "won" ? "CLEAR!" : "GAME OVER"}
            </span>
            {gameResult?.rankingResult && gameResult.rankingResult.rank != null && (
              <span className="text-sm text-yellow-400 font-bold">
                {gameResult.rankingResult.isNewRecord ? "🏆 새로운 1위!" : `전체 ${gameResult.rankingResult.rank}위`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div className="text-xs text-muted-foreground text-center space-x-3">
        <span>좌클릭 열기</span>
        <span>우클릭 🚩↔❓</span>
        <span>양클릭 주변 열기</span>
      </div>
    </div>
  );
}
