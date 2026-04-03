"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type { NonogramPublicState, NonogramDifficulty } from "@game-hub/shared-types";
import { NONOGRAM_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { useGameStore } from "@/stores/game-store";
import { getServerElapsed } from "@/lib/socket";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { GameHelpDialog } from "@/components/common/game-help-dialog";
import { HelpCircle } from "lucide-react";

const CELL_SIZES: Record<NonogramDifficulty, number> = {
  tiny: 40,
  beginner: 32,
  intermediate: 26,
  expert: 26,
  extreme: 22,
};

const THICK_COLOR = "rgba(0,229,255,0.35)";
const THIN_COLOR = "rgba(94,111,145,0.4)";
const FILLED_THICK_COLOR = "rgba(0,0,0,0.25)";
const FILLED_THIN_COLOR = "rgba(0,0,0,0.15)";
const SOLUTION_BG = "bg-yellow-500/15";
const HIGHLIGHT_BG = "rgba(0,229,255,0.08)";

export default function NonogramBoard({ isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState } = useGame(socket);
  const gameResult = useGameStore((s) => s.gameResult);
  const [elapsed, setElapsed] = useState(0);

  const state = gameState as NonogramPublicState | null;
  const playerBoard = useMemo(() => {
    if (!state) return null;
    const id = socket?.id && state.players[socket.id] ? socket.id : Object.keys(state.players)[0];
    return id ? state.players[id] : null;
  }, [state, socket?.id]);

  useEffect(() => {
    if (!state?.startedAt) return;
    if (playerBoard?.status === "completed") return;

    const update = () => setElapsed(Math.floor(getServerElapsed(state.startedAt!) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [state?.startedAt, playerBoard?.status]);

  const maxHintRowLen = useMemo(() => {
    if (!state) return 0;
    return Math.max(...state.rowHints.map((h) => h.length));
  }, [state]);

  const maxHintColLen = useMemo(() => {
    if (!state) return 0;
    return Math.max(...state.colHints.map((h) => h.length));
  }, [state]);

  const cellSize = state ? (CELL_SIZES[state.difficulty] ?? 32) : 32;

  // 좌클릭 사이클: hidden→filled→marked→hidden
  // 우클릭 사이클: hidden→marked→filled→hidden
  const nextState = useCallback((current: string, isLeft: boolean): "filled" | "marked" | "hidden" => {
    if (isLeft) {
      if (current === "hidden") return "filled";
      if (current === "filled") return "marked";
      return "hidden";
    }
    if (current === "hidden") return "marked";
    if (current === "marked") return "filled";
    return "hidden";
  }, []);

  // 드래그 상태 + 낙관적 업데이트
  const dragRef = useRef<{
    active: boolean;
    target: "filled" | "marked" | "hidden";
    cells: Set<string>;
    moves: { row: number; col: number; target: "filled" | "marked" | "hidden" }[];
  } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const rowHighlightRef = useRef<HTMLDivElement>(null);
  const colHighlightRef = useRef<HTMLDivElement>(null);
  const [pendingMoves, setPendingMoves] = useState<Map<string, "filled" | "marked" | "hidden">>(new Map());

  const handlePointerDown = useCallback((e: React.PointerEvent, row: number, col: number, currentCell: string) => {
    if (isSpectating) return;
    e.preventDefault();
    const isLeft = e.button === 0;
    const target = nextState(currentCell, isLeft);
    const key = `${row}-${col}`;
    dragRef.current = { active: true, target, cells: new Set([key]), moves: [{ row, col, target }] };
    setPendingMoves(new Map([[key, target]]));
  }, [isSpectating, nextState]);

  const showHighlight = useCallback((gameRow: number, gameCol: number) => {
    if (rowHighlightRef.current) {
      rowHighlightRef.current.style.display = "block";
      rowHighlightRef.current.style.top = `${(maxHintColLen + gameRow) * cellSize}px`;
    }
    if (colHighlightRef.current) {
      colHighlightRef.current.style.display = "block";
      colHighlightRef.current.style.left = `${(maxHintRowLen + gameCol) * cellSize}px`;
    }
  }, [maxHintColLen, maxHintRowLen, cellSize]);

  const clearHighlight = useCallback(() => {
    if (rowHighlightRef.current) rowHighlightRef.current.style.display = "none";
    if (colHighlightRef.current) colHighlightRef.current.style.display = "none";
  }, []);

  const handleGridPointerMove = useCallback((e: React.PointerEvent) => {
    const grid = gridContainerRef.current;
    if (!grid || !state) return;

    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const gridCol = Math.floor(x / cellSize);
    const gridRow = Math.floor(y / cellSize);
    const gameRow = gridRow - maxHintColLen;
    const gameCol = gridCol - maxHintRowLen;

    // 힌트 하이라이트
    if (gameRow >= 0 && gameRow < state.rows && gameCol >= 0 && gameCol < state.cols) {
      showHighlight(gameRow, gameCol);
    } else {
      clearHighlight();
    }

    // 드래그 처리
    const drag = dragRef.current;
    if (!drag?.active) return;
    if (gameRow < 0 || gameRow >= state.rows || gameCol < 0 || gameCol >= state.cols) return;
    const key = `${gameRow}-${gameCol}`;
    if (drag.cells.has(key)) return;
    drag.cells.add(key);
    drag.moves.push({ row: gameRow, col: gameCol, target: drag.target });
    setPendingMoves(prev => new Map(prev).set(key, drag.target));
  }, [cellSize, maxHintColLen, maxHintRowLen, state, showHighlight, clearHighlight]);

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    const moves = drag.moves;
    dragRef.current = null;
    if (!socket || moves.length === 0) return;
    socket.emit("game:nonogram-batch-move", moves, () => {
      setPendingMoves(new Map());
    });
  }, [socket]);

  // 도움말
  const [showHelp, setShowHelp] = useState(false);

  // 다시하기
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const handleRestart = useCallback(() => {
    if (!socket) return;
    socket.emit("game:nonogram-restart", () => {});
    setRestartDialogOpen(false);
  }, [socket]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (!socket) return;
    socket.emit("game:nonogram-undo", () => {});
  }, [socket]);

  const handleRedo = useCallback(() => {
    if (!socket) return;
    socket.emit("game:nonogram-redo", () => {});
  }, [socket]);

  const handleGridPointerLeave = useCallback(() => {
    handlePointerUp();
    clearHighlight();
  }, [handlePointerUp, clearHighlight]);

  // 그리드 밖에서 마우스 놓아도 드래그 종료 + batch 전송
  useEffect(() => {
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerUp]);

  // 키보드 단축키 (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const checkedHints = useMemo(() => new Set(playerBoard?.checkedHints ?? []), [playerBoard?.checkedHints]);
  const toggleHint = useCallback((key: string) => {
    if (!socket || isSpectating) return;
    socket.emit("game:nonogram-toggle-hint", key, () => {});
  }, [socket, isSpectating]);

  // 오류 검증
  const [verifyMsg, setVerifyMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleVerify = useCallback(() => {
    if (!socket) return;
    socket.emit("game:nonogram-verify", ({ errorCount, remaining }) => {
      if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      const text = errorCount > 0 ? "오류 있음" : `남은 칸 ${remaining}개`;
      setVerifyMsg({ text, isError: errorCount > 0 });
      setVerifyVisible(true);
      fadeTimerRef.current = setTimeout(() => setVerifyVisible(false), 1000);
      verifyTimerRef.current = setTimeout(() => setVerifyMsg(null), 1500);
    });
  }, [socket]);

  const gridCells = useMemo(() => {
    if (!state || !playerBoard) return null;

    const totalRows = maxHintColLen + state.rows;
    const totalCols = maxHintRowLen + state.cols;
    const cells: React.ReactNode[] = [];

    // box-shadow만으로 테두리 구현 — border 없이 모든 셀 크기 완전 동일
    const cols = state.cols;
    const rows = state.rows;
    function buildShadow(r: number, c: number, gameRow: number, gameCol: number, isCorner: boolean, filled = false) {
      const isLastCol = c === totalCols - 1;
      const isLastRow = r === totalRows - 1;
      const atHintGameRight = c === maxHintRowLen - 1;
      const atHintGameBottom = r === maxHintColLen - 1;
      const at5thCol = gameCol >= 0 && (gameCol + 1) % 5 === 0 && gameCol < cols - 1;
      const at5thRow = gameRow >= 0 && (gameRow + 1) % 5 === 0 && gameRow < rows - 1;
      const isFirstRow = r === 0 && !isCorner;
      const isFirstCol = c === 0 && !isCorner;
      const thick = filled ? FILLED_THICK_COLOR : THICK_COLOR;
      const thin = filled ? FILLED_THIN_COLOR : THIN_COLOR;

      const shadows: string[] = [];
      if (!isLastCol) {
        const color = (atHintGameRight || at5thCol) ? thick : thin;
        shadows.push(`inset -1px 0 0 ${color}`);
      }
      if (!isLastRow) {
        const color = (atHintGameBottom || at5thRow) ? thick : thin;
        shadows.push(`inset 0 -1px 0 ${color}`);
      }
      if (isFirstRow) shadows.push(`inset 0 1px 0 ${thick}`);
      if (isFirstCol) shadows.push(`inset 1px 0 0 ${thick}`);
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
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center ${hintKey && !isSpectating ? "cursor-pointer" : ""}`}
              style={{ boxShadow: shadow }}
              onClick={hintKey && !isSpectating ? () => toggleHint(hintKey) : undefined}
            >
              {hintValue !== null && hintKey && (
                <span
                  className={`font-mono select-none transition-colors ${checked ? "text-primary font-bold" : "text-muted-foreground"}`}
                >
                  {hintValue}
                </span>
              )}
            </div>,
          );
          continue;
        }

        // 게임 셀
        const cell = pendingMoves.get(`${gameRow}-${gameCol}`) ?? playerBoard.board[gameRow][gameCol];
        const isFilled = cell === "filled";
        const isSolutionCell = isSpectating && state.solution?.[gameRow]?.[gameCol] && !isFilled;
        const bg = isFilled
          ? "bg-primary"
          : isSolutionCell
            ? SOLUTION_BG
            : cell === "marked"
              ? "bg-muted"
              : "bg-[#2a3150] hover:bg-[#323b5c]";
        const cellShadow = isFilled ? buildShadow(r, c, gameRow, gameCol, false, true) : shadow;

        const disabled = playerBoard.status === "completed" || gameResult != null || !!isSpectating;
        cells.push(
          <button
            key={`${r}-${c}`}
            className={`flex items-center justify-center select-none transition-colors duration-75 touch-none ${bg}`}
            style={{ boxShadow: cellShadow }}
            onPointerDown={disabled ? undefined : (e) => handlePointerDown(e, gameRow, gameCol, cell)}
            onContextMenu={(e) => e.preventDefault()}
            disabled={disabled}
          >
            {cell === "marked" && (
              <span className="text-muted-foreground font-bold">✕</span>
            )}
          </button>,
        );
      }
    }
    return cells;
  }, [state, playerBoard, maxHintColLen, maxHintRowLen, checkedHints, toggleHint, gameResult, isSpectating, handlePointerDown, cellSize, pendingMoves]);

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
      {/* Difficulty label + help */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{difficultyConfig.label} ({state.rows}×{state.cols})</span>
        <button
          onClick={() => setShowHelp(true)}
          className="text-muted-foreground hover:text-primary transition-colors"
          title="게임 도움말"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Header: [시간 --- 진행률 --- 확인결과 --- 확인버튼 초기화] */}
      <div className="flex items-center justify-center w-full px-2">
        <div className="flex items-center justify-between w-full max-w-sm">
          <div className="flex items-center gap-1.5 text-lg font-mono font-bold bg-card border border-border text-primary px-3 py-1.5 rounded-lg neon-glow-cyan">
            <span className="text-base">⏱</span>
            {String(elapsed).padStart(3, "0")}
          </div>
          {verifyMsg && (
            <div
              className={`px-3 py-1 rounded-lg font-mono font-bold text-sm whitespace-nowrap transition-all duration-500 ${
                verifyMsg.isError
                  ? "bg-destructive/20 border border-destructive/40 text-destructive neon-glow-pink"
                  : "bg-primary/20 border border-primary/40 text-primary neon-glow-cyan"
              } ${verifyVisible ? "opacity-100" : "opacity-0"}`}
            >
              {verifyMsg.text}
            </div>
          )}
          {isSpectating ? (
            <div className="flex items-center gap-1.5 text-lg font-mono font-bold bg-card border border-border text-primary px-3 py-1.5 rounded-lg neon-glow-cyan">
              {playerBoard.progress}%
            </div>
          ) : !isGameOver ? (
            <div className="relative">
              <button
                className="text-sm font-mono font-bold bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 hover:border-primary/50 hover:neon-glow-cyan active:scale-95 transition-all cursor-pointer"
                onClick={handleVerify}
              >
                ✓ 확인
              </button>
              <button
                className="absolute left-full ml-2 top-0 text-sm font-mono font-bold bg-destructive/10 border border-destructive/30 text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/20 hover:border-destructive/50 hover:neon-glow-pink active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                onClick={() => setRestartDialogOpen(true)}
              >
                ↺ 초기화
              </button>
            </div>
          ) : (
            <div />
          )}
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
            className="relative"
          >
            <div
              ref={gridContainerRef}
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${maxHintRowLen + state.cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${maxHintColLen + state.rows}, ${cellSize}px)`,
                fontSize: hintFontSize,
              }}
              onPointerMove={handleGridPointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handleGridPointerLeave}
            >
              {gridCells}
            </div>

            {/* 힌트 하이라이트 바 — 행 힌트 영역 */}
            <div
              ref={rowHighlightRef}
              style={{
                display: "none",
                position: "absolute",
                top: 0,
                left: 0,
                width: maxHintRowLen * cellSize,
                height: cellSize,
                backgroundColor: HIGHLIGHT_BG,
                pointerEvents: "none",
                zIndex: 5,
              }}
            />
            {/* 힌트 하이라이트 바 — 열 힌트 영역 */}
            <div
              ref={colHighlightRef}
              style={{
                display: "none",
                position: "absolute",
                top: 0,
                left: 0,
                width: cellSize,
                height: maxHintColLen * cellSize,
                backgroundColor: HIGHLIGHT_BG,
                pointerEvents: "none",
                zIndex: 5,
              }}
            />

            {/* Game result overlay — 게임 셀 영역만 덮음 */}
            {isGameOver && (
              <div
                className="flex items-center justify-center bg-black/70"
                style={{
                  position: "absolute",
                  top: maxHintColLen * cellSize,
                  left: maxHintRowLen * cellSize,
                  width: state.cols * cellSize,
                  height: state.rows * cellSize,
                  zIndex: 9,
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-3xl font-display font-bold drop-shadow-lg ${
                    isCompleted ? "text-primary text-glow-cyan" : "text-destructive text-glow-pink"
                  }`}>
                    {isCompleted ? "CLEAR!" : "GAME OVER"}
                  </span>
                  {isCompleted && state.puzzleName && (
                    <span className="text-sm text-primary/80 font-medium drop-shadow-lg">
                      {state.puzzleName}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls hint */}
      {!isSpectating && (
        <div className="text-xs text-secondary-foreground text-center space-x-3">
          <span>좌클릭 채우기→✕→해제</span>
          <span>우클릭 ✕→채우기→해제</span>
          <span>드래그 연속 적용</span>
          <span>Ctrl+Z/Y 되돌리기</span>
          <span>숫자클릭 체크</span>
        </div>
      )}

      <ConfirmDialog
        open={restartDialogOpen}
        title="초기화"
        message={"보드를 초기 상태로 되돌립니다.\n진행 상태가 모두 사라집니다."}
        confirmText="초기화"
        cancelText="취소"
        onConfirm={handleRestart}
        onCancel={() => setRestartDialogOpen(false)}
      />

      <GameHelpDialog open={showHelp} onClose={() => setShowHelp(false)} title="노노그램">
        <div>
          <h3 className="text-foreground font-semibold mb-1">게임 방법</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>숫자 힌트를 보고 칸을 채워 그림을 완성한다</li>
            <li>숫자 = 연속으로 채워진 칸의 그룹 크기</li>
            <li>여러 숫자는 순서대로, 그룹 사이 최소 1칸 빈 칸</li>
            <li>0 = 해당 줄에 채워진 칸 없음</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">마우스 조작</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>좌클릭: 채우기 → X → 해제</li>
            <li>우클릭: X → 채우기 → 해제</li>
            <li>드래그: 여러 칸에 연속 적용</li>
            <li>힌트 숫자 클릭: 완료 체크 토글</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">키보드 단축키</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Ctrl+Z: 되돌리기</li>
            <li>Ctrl+Y: 다시 적용</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">보조 기능</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>확인: 오류 유무 및 남은 칸 수 확인</li>
            <li>초기화: 빈 상태로 되돌림 (같은 퍼즐 유지)</li>
            <li>힌트 하이라이트: 퍼즐 셀에 마우스를 올리면 해당 행/열 힌트 강조</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">승리 조건</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>채운 칸이 정답과 일치하면 승리</li>
            <li>X 마킹은 판정에 영향 없음</li>
          </ul>
        </div>
      </GameHelpDialog>
    </div>
  );
}
