"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function MinesweeperBoard({ roomId }: GameComponentProps) {
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
      if (!state || state.status !== "playing") return;
      if (state.board[row][col].status !== "hidden") return;
      const move: MinesweeperMove = { type: "reveal", row, col };
      makeMove(move);
    },
    [state, makeMove],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      if (!state || state.status !== "playing") return;
      const cell = state.board[row][col];
      if (cell.status === "revealed") return;

      const move: MinesweeperMove = {
        type: cell.status === "flagged" ? "unflag" : "flag",
        row,
        col,
      };
      makeMove(move);
    },
    [state, makeMove],
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
      >
        {state.board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              className={`flex items-center justify-center border font-bold select-none ${
                cell.status === "revealed"
                  ? "bg-gray-200 border-gray-300"
                  : "bg-gray-400 border-t-gray-200 border-l-gray-200 border-r-gray-500 border-b-gray-500 hover:bg-gray-350 active:bg-gray-300"
              }`}
              style={{ width: cellSize, height: cellSize, fontSize: cellSize > 30 ? 14 : 11 }}
              onClick={() => handleReveal(r, c)}
              onContextMenu={(e) => handleContextMenu(e, r, c)}
              disabled={state.status !== "playing"}
            >
              {cell.status === "flagged" && <span style={{ fontSize: cellSize > 30 ? 16 : 12 }}>🚩</span>}
              {cell.status === "revealed" && cell.hasMine && <span style={{ fontSize: cellSize > 30 ? 16 : 12 }}>💣</span>}
              {cell.status === "revealed" && !cell.hasMine && cell.adjacentMines !== undefined && cell.adjacentMines > 0 && (
                <span className={NUMBER_COLORS[cell.adjacentMines]}>{cell.adjacentMines}</span>
              )}
              {cell.status === "hidden" && cell.hasMine && <span style={{ fontSize: cellSize > 30 ? 16 : 12 }}>💣</span>}
            </button>
          )),
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
        <span>우클릭 깃발</span>
      </div>
    </div>
  );
}
