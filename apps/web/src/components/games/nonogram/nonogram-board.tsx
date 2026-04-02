"use client";

import { Fragment, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type { NonogramPublicState, NonogramMove, NonogramDifficulty } from "@game-hub/shared-types";
import { NONOGRAM_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { useGameStore } from "@/stores/game-store";

const CELL_SIZES: Record<NonogramDifficulty, number> = {
  tiny: 40,
  beginner: 32,
  intermediate: 26,
  expert: 22,
  extreme: 14,
};

export default function NonogramBoard({ isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, makeMove } = useGame(socket);
  const gameResult = useGameStore((s) => s.gameResult);
  const [elapsed, setElapsed] = useState(0);

  const state = gameState as NonogramPublicState | null;
  const msBaseRef = useRef<number | null>(null);

  // 플레이어 보드 (관전자는 첫 번째 플레이어 보드를 표시)
  const playerBoard = useMemo(() => {
    if (!state) return null;
    const id = socket?.id && state.players[socket.id] ? socket.id : Object.keys(state.players)[0];
    return id ? state.players[id] : null;
  }, [state, socket?.id]);

  useEffect(() => {
    if (!state?.startedAt) {
      msBaseRef.current = null;
      return;
    }

    if (playerBoard?.status === "completed") return;

    if (!msBaseRef.current) {
      msBaseRef.current = Date.now();
    }

    const update = () => setElapsed(Math.floor((Date.now() - msBaseRef.current!) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [state?.startedAt, playerBoard?.status]);

  const handleFill = useCallback(
    (row: number, col: number) => {
      if (isSpectating) return;
      const move: NonogramMove = { type: "fill", row, col };
      makeMove(move);
    },
    [isSpectating, makeMove],
  );

  const handleMark = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      if (isSpectating) return;
      const move: NonogramMove = { type: "mark", row, col };
      makeMove(move);
    },
    [isSpectating, makeMove],
  );

  const maxHintRowLen = useMemo(() => {
    if (!state) return 0;
    return Math.max(...state.rowHints.map((h) => h.length));
  }, [state]);

  const maxHintColLen = useMemo(() => {
    if (!state) return 0;
    return Math.max(...state.colHints.map((h) => h.length));
  }, [state]);

  // 힌트 체크 상태 (클라이언트 전용) — key: "row-r-i" 또는 "col-c-i"
  const [checkedHints, setCheckedHints] = useState<Set<string>>(new Set());
  const toggleHint = useCallback((key: string) => {
    setCheckedHints((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!state || !playerBoard) return null;

  const difficultyConfig = NONOGRAM_DIFFICULTY_CONFIGS[state.difficulty];
  const cellSize = CELL_SIZES[state.difficulty] ?? 32;
  const hintFontSize = cellSize > 20 ? 12 : 9;
  const isCompleted = playerBoard.status === "completed";
  const isGameOver = gameResult != null;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Difficulty label */}
      <div className="text-sm text-muted-foreground">
        {difficultyConfig.label} ({state.rows}×{state.cols})
      </div>

      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-sm px-2">
        <div className="flex items-center gap-1.5 text-lg font-mono font-bold bg-card border border-border text-primary px-3 py-1.5 rounded-lg neon-glow-cyan">
          {playerBoard.progress}%
        </div>
        <div />
        <div className="flex items-center gap-1.5 text-lg font-mono font-bold bg-card border border-border text-primary px-3 py-1.5 rounded-lg neon-glow-cyan">
          <span className="text-base">⏱</span>
          {String(elapsed).padStart(3, "0")}
        </div>
      </div>

      {/* Board with hints */}
      <div className="relative">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${maxHintRowLen * (cellSize * 0.6)}px repeat(${state.cols}, ${cellSize}px)`,
            gridTemplateRows: `${maxHintColLen * (cellSize * 0.6)}px repeat(${state.rows}, ${cellSize}px)`,
          }}
        >
          {/* Top-left empty corner */}
          <div />

          {/* Column hints */}
          {state.colHints.map((hints, c) => (
            <div
              key={`ch-${c}`}
              className="flex flex-col items-center justify-end pb-0.5"
              style={{ fontSize: hintFontSize }}
            >
              {hints.map((h, i) => {
                const key = `col-${c}-${i}`;
                const checked = checkedHints.has(key);
                return (
                  <span
                    key={i}
                    className={`leading-tight font-mono cursor-pointer select-none transition-colors ${checked ? "text-primary/40 line-through" : "text-muted-foreground"}`}
                    onClick={() => toggleHint(key)}
                  >
                    {h}
                  </span>
                );
              })}
            </div>
          ))}

          {/* Row hints + cells */}
          {playerBoard.board.map((row, r) => (
            <Fragment key={`row-${r}`}>
              {/* Row hint */}
              <div
                className="flex items-center justify-end gap-0.5 pr-1"
                style={{ fontSize: hintFontSize }}
              >
                {state.rowHints[r].map((h, i) => {
                  const key = `row-${r}-${i}`;
                  const checked = checkedHints.has(key);
                  return (
                    <span
                      key={i}
                      className={`font-mono cursor-pointer select-none transition-colors ${checked ? "text-primary/40 line-through" : "text-muted-foreground"}`}
                      onClick={() => toggleHint(key)}
                    >
                      {h}
                    </span>
                  );
                })}
              </div>

              {/* Cells */}
              {row.map((cell, c) => {
                const borderRight = (c + 1) % 5 === 0 && c < state.cols - 1;
                const borderBottom = (r + 1) % 5 === 0 && r < state.rows - 1;
                return (
                  <button
                    key={`${r}-${c}`}
                    className={`flex items-center justify-center select-none border border-border/50 transition-colors duration-75 ${
                      cell === "filled"
                        ? "bg-primary"
                        : cell === "marked"
                          ? "bg-muted"
                          : "bg-[#2a3150] hover:bg-[#323b5c]"
                    } ${borderRight ? "!border-r-primary/30" : ""} ${borderBottom ? "!border-b-primary/30" : ""}`}
                    style={{ width: cellSize, height: cellSize, fontSize: hintFontSize }}
                    onClick={() => handleFill(r, c)}
                    onContextMenu={(e) => handleMark(e, r, c)}
                    disabled={isCompleted || isGameOver || isSpectating}
                  >
                    {cell === "marked" && (
                      <span className="text-muted-foreground font-bold">✕</span>
                    )}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* Game result overlay */}
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
            <span className={`text-3xl font-display font-bold drop-shadow-lg ${
              isCompleted ? "text-primary text-glow-cyan" : "text-destructive text-glow-pink"
            }`}>
              {isCompleted ? "CLEAR!" : "GAME OVER"}
            </span>
            {gameResult?.reason && (
              <span className="text-sm text-white/80">{gameResult.reason}</span>
            )}
          </div>
        )}
      </div>

      {/* Controls hint */}
      {!isSpectating && (
        <div className="text-xs text-secondary-foreground text-center space-x-3">
          <span>좌클릭 채우기/비우기</span>
          <span>우클릭 ✕마킹/해제</span>
          <span>숫자클릭 체크</span>
        </div>
      )}
    </div>
  );
}
