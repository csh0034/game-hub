"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  expert: 26,
  extreme: 22,
};

const THICK_COLOR = "rgba(0,229,255,0.35)";
const THIN_COLOR = "rgba(94,111,145,0.4)";

export default function NonogramBoard({ isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, makeMove } = useGame(socket);
  const gameResult = useGameStore((s) => s.gameResult);
  const [elapsed, setElapsed] = useState(0);

  const state = gameState as NonogramPublicState | null;
  const msBaseRef = useRef<number | null>(null);

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
    if (!msBaseRef.current) msBaseRef.current = Date.now();

    const update = () => setElapsed(Math.floor((Date.now() - msBaseRef.current!) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [state?.startedAt, playerBoard?.status]);

  const handleFill = useCallback(
    (row: number, col: number) => {
      if (isSpectating) return;
      makeMove({ type: "fill", row, col } as NonogramMove);
    },
    [isSpectating, makeMove],
  );

  const handleMark = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      if (isSpectating) return;
      makeMove({ type: "mark", row, col } as NonogramMove);
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

  const [checkedHints, setCheckedHints] = useState<Set<string>>(new Set());
  const toggleHint = useCallback((key: string) => {
    setCheckedHints((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const cellSize = state ? (CELL_SIZES[state.difficulty] ?? 32) : 32;

  const gridCells = useMemo(() => {
    if (!state || !playerBoard) return null;

    const totalRows = maxHintColLen + state.rows;
    const totalCols = maxHintRowLen + state.cols;
    const cells: React.ReactNode[] = [];

    // box-shadow만으로 테두리 구현 — border 없이 모든 셀 크기 완전 동일
    const cols = state.cols;
    const rows = state.rows;
    function buildShadow(r: number, c: number, gameRow: number, gameCol: number, isCorner: boolean) {
      const isLastCol = c === totalCols - 1;
      const isLastRow = r === totalRows - 1;
      const atHintGameRight = c === maxHintRowLen - 1;
      const atHintGameBottom = r === maxHintColLen - 1;
      const at5thCol = gameCol >= 0 && (gameCol + 1) % 5 === 0 && gameCol < cols - 1;
      const at5thRow = gameRow >= 0 && (gameRow + 1) % 5 === 0 && gameRow < rows - 1;
      const isFirstRow = r === 0 && !isCorner;
      const isFirstCol = c === 0 && !isCorner;

      const shadows: string[] = [];
      if (!isLastCol) {
        const color = (atHintGameRight || at5thCol) ? THICK_COLOR : THIN_COLOR;
        shadows.push(`inset -1px 0 0 ${color}`);
      }
      if (!isLastRow) {
        const color = (atHintGameBottom || at5thRow) ? THICK_COLOR : THIN_COLOR;
        shadows.push(`inset 0 -1px 0 ${color}`);
      }
      if (isFirstRow) shadows.push(`inset 0 1px 0 ${THICK_COLOR}`);
      if (isFirstCol) shadows.push(`inset 1px 0 0 ${THICK_COLOR}`);
      return shadows.length > 0 ? shadows.join(", ") : "none";
    }

    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < totalCols; c++) {
        const gameRow = r - maxHintColLen;
        const gameCol = c - maxHintRowLen;
        const isCorner = r < maxHintColLen && c < maxHintRowLen;
        const isColHint = r < maxHintColLen && c >= maxHintRowLen;
        const isRowHint = r >= maxHintColLen && c < maxHintRowLen;

        if (isCorner) {
          // 코너: 힌트-게임 경계선만 표시, 내부 그리드선 없음
          const cornerShadows: string[] = [];
          if (c === maxHintRowLen - 1) cornerShadows.push(`inset -1px 0 0 ${THICK_COLOR}`);
          if (r === maxHintColLen - 1) cornerShadows.push(`inset 0 -1px 0 ${THICK_COLOR}`);
          cells.push(<div key={`${r}-${c}`} style={{ boxShadow: cornerShadows.join(", ") || "none" }} />);
          continue;
        }

        const shadow = buildShadow(r, c, gameRow, gameCol, false);

        if (isColHint || isRowHint) {
          let hintValue: number | null = null;
          let hintKey: string | null = null;

          if (isColHint) {
            const hints = state.colHints[gameCol];
            const hintIdx = r - (maxHintColLen - hints.length);
            if (hintIdx >= 0) {
              hintValue = hints[hintIdx];
              hintKey = `col-${gameCol}-${hintIdx}`;
            }
          } else {
            const hints = state.rowHints[gameRow];
            const hintIdx = c - (maxHintRowLen - hints.length);
            if (hintIdx >= 0) {
              hintValue = hints[hintIdx];
              hintKey = `row-${gameRow}-${hintIdx}`;
            }
          }

          const checked = hintKey ? checkedHints.has(hintKey) : false;
          cells.push(
            <div key={`${r}-${c}`} className="flex items-center justify-center" style={{ boxShadow: shadow }}>
              {hintValue !== null && hintKey && (
                <span
                  className={`font-mono cursor-pointer select-none transition-colors ${checked ? "text-primary font-bold" : "text-muted-foreground"}`}
                  onClick={() => toggleHint(hintKey)}
                >
                  {hintValue}
                </span>
              )}
            </div>,
          );
          continue;
        }

        // 게임 셀
        const cell = playerBoard.board[gameRow][gameCol];
        const bg = cell === "filled"
          ? "bg-primary"
          : cell === "marked"
            ? "bg-muted"
            : "bg-[#2a3150] hover:bg-[#323b5c]";

        cells.push(
          <button
            key={`${r}-${c}`}
            className={`flex items-center justify-center select-none transition-colors duration-75 ${bg}`}
            style={{ boxShadow: shadow }}
            onClick={() => handleFill(gameRow, gameCol)}
            onContextMenu={(e) => handleMark(e, gameRow, gameCol)}
            disabled={playerBoard.status === "completed" || gameResult != null || !!isSpectating}
          >
            {cell === "marked" && (
              <span className="text-muted-foreground font-bold">✕</span>
            )}
          </button>,
        );
      }
    }
    return cells;
  }, [state, playerBoard, maxHintColLen, maxHintRowLen, checkedHints, toggleHint, gameResult, isSpectating, handleFill, handleMark, cellSize]);

  if (!state || !playerBoard) return null;

  const difficultyConfig = NONOGRAM_DIFFICULTY_CONFIGS[state.difficulty];
  const hintFontSize = Math.min(Math.max(Math.floor(cellSize * 0.55), 8), 13);
  const isCompleted = playerBoard.status === "completed";
  const isGameOver = gameResult != null;

  // 게임 영역 크기
  const gameAreaW = state.cols * cellSize;
  const gameAreaH = state.rows * cellSize;

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

      {/* 게임 영역 크기 래퍼 — 중앙 배치의 기준점, marginTop으로 힌트 영역 공간 확보 */}
      <div style={{ width: gameAreaW, height: gameAreaH, position: "relative", overflow: "visible", marginTop: maxHintColLen * cellSize }}>
        {/* 전체 그리드 (힌트 + 게임) — 우하단 고정, 힌트는 왼쪽/위로 확장 */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            borderRight: `2px solid ${THICK_COLOR}`,
            borderBottom: `2px solid ${THICK_COLOR}`,
            borderRadius: 4,
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${maxHintRowLen + state.cols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${maxHintColLen + state.rows}, ${cellSize}px)`,
              fontSize: hintFontSize,
            }}
          >
            {gridCells}
          </div>
        </div>

        {/* Game result overlay — 게임 영역만 덮음 */}
        {isGameOver && (
          <div
            className="flex flex-col items-center justify-center bg-black/70 gap-3"
            style={{ position: "absolute", inset: 0, zIndex: 10 }}
          >
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
