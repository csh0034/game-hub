"use client";

import { useState, useEffect } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { HelpCircle } from "lucide-react";
import type { GomokuState, GomokuMove } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { GameHelpDialog } from "@/components/common/game-help-dialog";
import { getServerElapsed } from "@/lib/socket";

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

  useEffect(() => {
    if (!state || gameResult) return;
    const interval = setInterval(() => {
      const turnElapsed = getServerElapsed(state.turnStartedAt) / 1000;
      setRemainingTime(Math.max(0, state.turnTimeSeconds - turnElapsed));
      setElapsedTime(Math.floor(getServerElapsed(state.gameStartedAt) / 1000));
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
      <div className="w-full relative flex items-stretch gap-3" style={{ width: BOARD_PX }}>
        {/* 흑 플레이어 */}
        <div className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
          !gameResult && state.currentTurn === "black"
            ? "bg-card border-primary/30 neon-glow-cyan"
            : "bg-card/50 border-border/30 opacity-60"
        }`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-950 shadow-md border border-gray-600 shrink-0" />
          <div className="min-w-0">
            <div className={`text-sm font-display font-bold truncate ${state.currentTurn === "black" ? "text-foreground" : "text-muted-foreground"}`}>
              흑{myColor === "black" ? " (나)" : ""}
            </div>
            {!gameResult && state.currentTurn === "black" && (
              <div className="text-[10px] text-success font-medium">착수 중</div>
            )}
          </div>
        </div>

        {/* 중앙 타이머 + 정보 */}
        <div className="flex flex-col items-center justify-center px-4 py-1 bg-card border border-border/50 rounded-xl min-w-[100px] neon-glow-cyan">
          <div className={`text-2xl font-mono font-black tabular-nums leading-tight ${remainingTime <= 5 ? "text-accent animate-pulse" : "text-foreground"}`}>
            {Math.round(remainingTime)}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">초</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {String(Math.floor(elapsedTime / 60)).padStart(2, "0")}:{String(elapsedTime % 60).padStart(2, "0")} · {state.moveCount}수
          </div>
        </div>

        {/* 백 플레이어 */}
        <div className={`flex-1 flex items-center justify-end gap-3 px-4 py-2.5 rounded-xl border transition-all ${
          !gameResult && state.currentTurn === "white"
            ? "bg-card border-primary/30 neon-glow-cyan"
            : "bg-card/50 border-border/30 opacity-60"
        }`}>
          <div className="min-w-0 text-right">
            <div className={`text-sm font-display font-bold truncate ${state.currentTurn === "white" ? "text-foreground" : "text-muted-foreground"}`}>
              백{myColor === "white" ? " (나)" : ""}
            </div>
            {!gameResult && state.currentTurn === "white" && (
              <div className="text-[10px] text-success font-medium">착수 중</div>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-gray-200 shadow-md border border-gray-300 shrink-0" />
        </div>

        {/* 도움말 버튼 */}
        <button
          onClick={() => setShowHelp(true)}
          className="absolute -right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
          title="게임 도움말"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* 턴 표시 바 */}
      {!gameResult && (
        <div className={`px-4 py-1.5 rounded-full text-xs font-display font-semibold tracking-wide ${
          isMyTurn
            ? "bg-primary/10 text-primary border border-primary/30 text-glow-cyan"
            : "bg-card text-muted-foreground border border-border/50"
        }`}>
          {isMyTurn ? "내 차례입니다" : "상대 차례입니다"}
        </div>
      )}

      {/* 오목 보드 */}
      <div
        className="relative rounded-xl shadow-2xl"
        style={{
          width: BOARD_PX,
          height: BOARD_PX,
          background: "linear-gradient(145deg, #0d1225, #111628, #0a0e1a)",
        }}
      >
        {/* 보드 테두리 */}
        <div className="absolute inset-0 rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(0,229,255,0.08)] pointer-events-none" />

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
                stroke="rgba(0,229,255,0.15)"
                strokeWidth={0.8}
              />
              <line
                x1={PADDING + i * CELL_SIZE}
                y1={PADDING}
                x2={PADDING + i * CELL_SIZE}
                y2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                stroke="rgba(0,229,255,0.15)"
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
            stroke="rgba(0,229,255,0.3)"
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
                fill="rgba(0,229,255,0.4)"
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
                    } ${isLast ? "ring-2 ring-accent" : ""} ${isWinCell(row, col) ? "ring-2 ring-neon-yellow shadow-[0_0_8px_rgba(251,191,36,0.4)] scale-110" : ""}`}
                  />
                )}
                {!stone && isMyTurn && !gameResult && !isForbidden(row, col) && (
                  <div className={`w-[30px] h-[30px] rounded-full mx-auto opacity-0 hover:opacity-25 transition-opacity ${
                    myColor === "black" ? "bg-gray-900" : "bg-white"
                  }`} />
                )}
                {!stone && !gameResult && (isSpectating || myColor === "black") && isForbidden(row, col) && (
                  <div className="w-[24px] h-[24px] mx-auto flex items-center justify-center text-accent text-base font-extrabold drop-shadow-[0_0_4px_rgba(255,45,111,0.5)]">
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
        <div className="gomoku-result-enter w-full text-center py-4 px-6 rounded-xl border border-border bg-card/80 neon-glow-cyan" style={{ maxWidth: BOARD_PX }}>
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-lg font-display font-black ${
            isSpectating
              ? "bg-primary/10 text-primary border border-primary/30"
              : gameResult.winnerId === socket?.id
                ? "bg-success/10 text-success border border-success/30"
                : gameResult.winnerId === null
                  ? "bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30"
                  : "bg-accent/10 text-accent border border-accent/30"
          }`}>
            <span className="text-2xl">
              {isSpectating
                ? gameResult.winnerId === null ? "🤝" : "🏆"
                : gameResult.winnerId === socket?.id ? "🏆" : gameResult.winnerId === null ? "🤝" : "😢"}
            </span>
            {isSpectating
              ? gameResult.winnerId === null
                ? "무승부"
                : `${gameResult.winnerId === state.players.black ? "흑" : "백"} 승리!`
              : gameResult.winnerId === socket?.id
                ? "승리!"
                : gameResult.winnerId === null
                  ? "무승부"
                  : "패배"}
          </div>
          <p className="text-sm text-muted-foreground mt-2">{gameResult.reason}</p>
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
