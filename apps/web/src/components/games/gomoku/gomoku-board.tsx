"use client";

import { useState, useEffect } from "react";
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

export default function GomokuBoard({ roomId }: GameComponentProps) {
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
      setRemainingTime(Math.max(0, state.turnTimeSeconds - (Date.now() - state.turnStartedAt) / 1000));
      setElapsedTime(Math.floor((Date.now() - state.gameStartedAt) / 1000));
    }, 200);
    return () => clearInterval(interval);
  }, [state?.turnStartedAt, state?.gameStartedAt, state, gameResult]);

  if (!state) return null;

  const isMyTurn = state.players[state.currentTurn] === socket?.id;

  const handleClick = (row: number, col: number) => {
    if (!isMyTurn) return;
    if (state.board[row][col] !== null) return;
    const move: GomokuMove = { row, col };
    makeMove(move);
  };

  const myColor = socket?.id === state.players.black ? "black" : "white";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-end w-full" style={{ maxWidth: BOARD_PX }}>
        <button
          onClick={() => setShowHelp(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="게임 도움말"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-900 border border-gray-600" />
          <span className={state.currentTurn === "black" ? "text-foreground font-bold" : "text-muted-foreground"}>
            흑 {myColor === "black" ? "(나)" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-white border border-gray-400" />
          <span className={state.currentTurn === "white" ? "text-foreground font-bold" : "text-muted-foreground"}>
            백 {myColor === "white" ? "(나)" : ""}
          </span>
        </div>
        <span className="text-muted-foreground">·</span>
        <span className={isMyTurn ? "text-primary font-bold" : "text-muted-foreground"}>
          {isMyTurn ? "내 차례" : "상대 차례"}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className={`font-mono font-bold ${remainingTime <= 5 ? "text-red-500" : "text-foreground"}`}>
          {Math.round(remainingTime)}초
        </span>
      </div>

      <div
        className="relative bg-amber-700 rounded-lg shadow-xl"
        style={{ width: BOARD_PX, height: BOARD_PX }}
      >
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
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1}
              />
              <line
                x1={PADDING + i * CELL_SIZE}
                y1={PADDING}
                x2={PADDING + i * CELL_SIZE}
                y2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1}
              />
            </g>
          ))}
          {/* Star points */}
          {[3, 7, 11].flatMap((r) =>
            [3, 7, 11].map((c) => (
              <circle
                key={`star-${r}-${c}`}
                cx={PADDING + c * CELL_SIZE}
                cy={PADDING + r * CELL_SIZE}
                r={3}
                fill="rgba(0,0,0,0.5)"
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
                disabled={!isMyTurn || stone !== null}
              >
                {stone && (
                  <div
                    className={`w-[30px] h-[30px] rounded-full mx-auto shadow-md transition-transform ${
                      stone === "black"
                        ? "bg-gradient-to-br from-gray-700 to-gray-950"
                        : "bg-gradient-to-br from-white to-gray-200 border border-gray-300"
                    } ${isLast ? "ring-2 ring-primary ring-offset-1 ring-offset-amber-700" : ""}`}
                  />
                )}
                {!stone && isMyTurn && (
                  <div className="w-[30px] h-[30px] rounded-full mx-auto opacity-0 hover:opacity-30 transition-opacity bg-gray-500" />
                )}
              </button>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        수: {state.moveCount} · 경과 {String(Math.floor(elapsedTime / 60)).padStart(2, "0")}:{String(elapsedTime % 60).padStart(2, "0")}
      </p>

      {gameResult && (
        <div className="text-center">
          <p className={`text-lg font-bold ${
            gameResult.winnerId === socket?.id ? "text-green-600" :
            gameResult.winnerId === null ? "text-yellow-600" : "text-red-600"
          }`}>
            {gameResult.winnerId === socket?.id
              ? "승리!"
              : gameResult.winnerId === null
                ? "무승부"
                : "패배"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{gameResult.reason}</p>
        </div>
      )}

      <GameHelpDialog open={showHelp} onClose={() => setShowHelp(false)} title="오목">
        <div>
          <h3 className="text-foreground font-semibold mb-1">게임 방법</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>15×15 보드에서 흑과 백이 번갈아 돌을 놓는다</li>
            <li>흑이 먼저 시작한다</li>
            <li>가로, 세로, 대각선으로 5개 이상 연속으로 놓으면 승리</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">턴 제한시간</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>제한시간: {state.turnTimeSeconds}초</li>
            <li>시간 초과 시 상대에게 턴이 넘어간다</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">특이 사항</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>금수 규칙 없음 (삼삼, 사사 허용)</li>
            <li>장목(6목 이상) 허용</li>
            <li>225칸이 모두 차면 무승부</li>
          </ul>
        </div>
      </GameHelpDialog>
    </div>
  );
}
