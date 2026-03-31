"use client";

import { useState, useEffect, useRef } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { HelpCircle } from "lucide-react";
import type { GomokuState, GomokuMove } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { GameHelpDialog } from "@/components/common/game-help-dialog";

const BOARD_SIZE = 15;
const CELL_SIZE = 36;
const PADDING = 24;
const BOARD_PX = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;

export default function GomokuBoard({ isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, gameResult, makeMove } = useGame(socket);

  const state = gameState as GomokuState | null;

  const turnTime = state?.turnTimeSeconds ?? 30;
  const [remainingTime, setRemainingTime] = useState(turnTime);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const turnBaseRef = useRef<{ localStart: number; key: number } | null>(null);
  const gameBaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state || gameResult) return;
    if (!turnBaseRef.current || turnBaseRef.current.key !== state.turnStartedAt) {
      turnBaseRef.current = { localStart: Date.now(), key: state.turnStartedAt };
    }
    if (!gameBaseRef.current) {
      gameBaseRef.current = Date.now();
    }
    const interval = setInterval(() => {
      const turnElapsed = (Date.now() - turnBaseRef.current!.localStart) / 1000;
      setRemainingTime(Math.max(0, state.turnTimeSeconds - turnElapsed));
      setElapsedTime(Math.floor((Date.now() - gameBaseRef.current!) / 1000));
    }, 200);
    return () => clearInterval(interval);
  }, [state?.turnStartedAt, state?.gameStartedAt, state, gameResult]);

  if (!state) return null;

  const isMyTurn = state.players[state.currentTurn] === socket?.id;

  const isForbidden = (row: number, col: number) =>
    state.forbiddenMoves?.some((m) => m.row === row && m.col === col) ?? false;

  const handleClick = (row: number, col: number) => {
    if (isSpectating) return;
    if (gameResult) return;
    if (!isMyTurn) return;
    if (state.board[row][col] !== null) return;
    if (isForbidden(row, col)) return;
    const move: GomokuMove = { row, col };
    makeMove(move);
  };

  const isWinCell = (row: number, col: number) =>
    state.winLine?.some((c) => c.row === row && c.col === col) ?? false;

  const myColor = socket?.id === state.players.black ? "black" : "white";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 상단 패널: 플레이어 정보 + 타이머 */}
      <div className="w-full flex items-stretch gap-3" style={{ maxWidth: BOARD_PX }}>
        {/* 흑 플레이어 */}
        <div className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
          state.currentTurn === "black"
            ? "bg-slate-800 border-slate-600 shadow-lg shadow-slate-900/50"
            : "bg-slate-900/50 border-slate-700/30 opacity-60"
        }`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-950 shadow-md border border-gray-600 shrink-0" />
          <div className="min-w-0">
            <div className={`text-sm font-bold truncate ${state.currentTurn === "black" ? "text-white" : "text-slate-400"}`}>
              흑{myColor === "black" ? " (나)" : ""}
            </div>
            {state.currentTurn === "black" && (
              <div className="text-[10px] text-emerald-400 font-medium">착수 중</div>
            )}
          </div>
        </div>

        {/* 중앙 타이머 + 정보 */}
        <div className="flex flex-col items-center justify-center px-4 py-1 bg-slate-900 border border-slate-700/50 rounded-xl min-w-[100px]">
          <div className={`text-2xl font-black tabular-nums leading-tight ${remainingTime <= 5 ? "text-red-400 animate-pulse" : "text-white"}`}>
            {Math.round(remainingTime)}
            <span className="text-xs font-normal text-slate-400 ml-0.5">초</span>
          </div>
          <div className="text-[10px] text-slate-500 tabular-nums">
            {String(Math.floor(elapsedTime / 60)).padStart(2, "0")}:{String(elapsedTime % 60).padStart(2, "0")} · {state.moveCount}수
          </div>
        </div>

        {/* 백 플레이어 */}
        <div className={`flex-1 flex items-center justify-end gap-3 px-4 py-2.5 rounded-xl border transition-all ${
          state.currentTurn === "white"
            ? "bg-slate-800 border-slate-600 shadow-lg shadow-slate-900/50"
            : "bg-slate-900/50 border-slate-700/30 opacity-60"
        }`}>
          <div className="min-w-0 text-right">
            <div className={`text-sm font-bold truncate ${state.currentTurn === "white" ? "text-white" : "text-slate-400"}`}>
              백{myColor === "white" ? " (나)" : ""}
            </div>
            {state.currentTurn === "white" && (
              <div className="text-[10px] text-emerald-400 font-medium">착수 중</div>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-gray-200 shadow-md border border-gray-300 shrink-0" />
        </div>

        {/* 도움말 버튼 */}
        <button
          onClick={() => setShowHelp(true)}
          className="self-center text-slate-500 hover:text-white transition-colors"
          title="게임 도움말"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* 턴 표시 바 */}
      <div className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
        isMyTurn
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "bg-slate-800 text-slate-400 border border-slate-700/50"
      }`}>
        {isMyTurn ? "내 차례입니다" : "상대 차례입니다"}
      </div>

      {/* 오목 보드 */}
      <div
        className="relative rounded-xl shadow-2xl"
        style={{
          width: BOARD_PX,
          height: BOARD_PX,
          background: "linear-gradient(145deg, #c8943e, #b8842e, #a8742e)",
        }}
      >
        {/* 보드 테두리 */}
        <div className="absolute inset-0 rounded-xl border border-amber-600/50 shadow-inner pointer-events-none" />

        {/* Grid lines */}
        <svg
          width={BOARD_PX}
          height={BOARD_PX}
          className="absolute inset-0"
        >
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <g key={i}>
              <line
                x1={PADDING}
                y1={PADDING + i * CELL_SIZE}
                x2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                y2={PADDING + i * CELL_SIZE}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={0.8}
              />
              <line
                x1={PADDING + i * CELL_SIZE}
                y1={PADDING}
                x2={PADDING + i * CELL_SIZE}
                y2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={0.8}
              />
            </g>
          ))}
          {/* 외곽선 강조 */}
          <rect
            x={PADDING}
            y={PADDING}
            width={(BOARD_SIZE - 1) * CELL_SIZE}
            height={(BOARD_SIZE - 1) * CELL_SIZE}
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1.5}
          />
          {/* Star points */}
          {[3, 7, 11].flatMap((r) =>
            [3, 7, 11].map((c) => (
              <circle
                key={`star-${r}-${c}`}
                cx={PADDING + c * CELL_SIZE}
                cy={PADDING + r * CELL_SIZE}
                r={3.5}
                fill="rgba(0,0,0,0.55)"
              />
            ))
          )}
        </svg>

        {/* Clickable cells + stones */}
        {Array.from({ length: BOARD_SIZE }).map((_, row) =>
          Array.from({ length: BOARD_SIZE }).map((_, col) => {
            const stone = state.board[row][col];
            const isLast =
              state.lastMove?.row === row && state.lastMove?.col === col;
            return (
              <button
                key={`${row}-${col}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: PADDING + col * CELL_SIZE,
                  top: PADDING + row * CELL_SIZE,
                  width: CELL_SIZE - 2,
                  height: CELL_SIZE - 2,
                }}
                onClick={() => handleClick(row, col)}
                disabled={!!gameResult || !isMyTurn || stone !== null || isForbidden(row, col)}
              >
                {stone && (
                  <div
                    className={`w-[30px] h-[30px] rounded-full mx-auto transition-transform ${
                      stone === "black"
                        ? "bg-gradient-to-br from-gray-500 to-gray-950 shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                        : "bg-gradient-to-br from-white to-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.3)] border border-gray-200/80"
                    } ${isLast ? "ring-2 ring-red-400" : ""} ${isWinCell(row, col) ? "ring-2 ring-yellow-400 scale-110" : ""}`}
                  />
                )}
                {!stone && isMyTurn && !gameResult && !isForbidden(row, col) && (
                  <div className={`w-[30px] h-[30px] rounded-full mx-auto opacity-0 hover:opacity-25 transition-opacity ${
                    myColor === "black" ? "bg-gray-900" : "bg-white"
                  }`} />
                )}
                {!stone && !gameResult && (isSpectating || myColor === "black") && isForbidden(row, col) && (
                  <div className="w-[24px] h-[24px] mx-auto flex items-center justify-center text-red-500 text-base font-extrabold drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]">
                    ✕
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* 게임 결과 */}
      {gameResult && (
        <div className="gomoku-result-enter w-full text-center py-4 px-6 rounded-xl border" style={{ maxWidth: BOARD_PX }}>
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-lg font-black ${
            gameResult.winnerId === socket?.id
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : gameResult.winnerId === null
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}>
            <span className="text-2xl">
              {gameResult.winnerId === socket?.id ? "🏆" : gameResult.winnerId === null ? "🤝" : "😢"}
            </span>
            {gameResult.winnerId === socket?.id
              ? "승리!"
              : gameResult.winnerId === null
                ? "무승부"
                : "패배"}
          </div>
          <p className="text-sm text-slate-400 mt-2">{gameResult.reason}</p>
          <style>{`
            .gomoku-result-enter {
              animation: gomoku-result-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes gomoku-result-pop {
              0% { transform: scale(0.9); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      <GameHelpDialog open={showHelp} onClose={() => setShowHelp(false)} title="오목">
        <div>
          <h3 className="text-foreground font-semibold mb-1">게임 방법</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>15×15 보드에서 흑과 백이 번갈아 돌을 놓는다</li>
            <li>흑이 먼저 시작한다</li>
            <li>가로, 세로, 대각선으로 5개 연속으로 놓으면 승리</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">턴 제한시간</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>제한시간: {state.turnTimeSeconds}초</li>
            <li>시간 초과 시 상대에게 턴이 넘어간다</li>
          </ul>
        </div>
        {state.forbiddenMoves !== null ? (
          <div>
            <h3 className="text-foreground font-semibold mb-1">렌주룰 (금수 규칙)</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>흑은 삼삼(3-3), 사사(4-4), 장목(6목 이상) 금수</li>
              <li>정확히 5목 완성 시 금수 예외 (승리)</li>
              <li>백은 제한 없음 (6목 이상도 승리)</li>
              <li>금수 위치는 ✕ 표시로 확인 가능</li>
              <li>225칸이 모두 차면 무승부</li>
            </ul>
          </div>
        ) : (
          <div>
            <h3 className="text-foreground font-semibold mb-1">특이 사항</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>금수 규칙 없음 (삼삼, 사사 허용)</li>
              <li>장목(6목 이상) 허용</li>
              <li>225칸이 모두 차면 무승부</li>
            </ul>
          </div>
        )}
      </GameHelpDialog>
    </div>
  );
}
