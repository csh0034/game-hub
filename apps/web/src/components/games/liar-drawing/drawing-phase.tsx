"use client";

import { useState, useEffect, useCallback } from "react";
import type { LiarDrawingPublicState, DrawPoint, DrawTool, PenColor, PenThickness } from "@game-hub/shared-types";
import { getServerElapsed, type GameSocket } from "@/lib/socket";
import { DrawingCanvas } from "./drawing-canvas";
import { DrawingToolbar } from "./drawing-toolbar";

interface DrawingPhaseProps {
  state: LiarDrawingPublicState;
  socket: GameSocket;
  myId: string;
  keyword: string | null;
  isSpectating?: boolean;
  liarNickname?: string;
}

export function DrawingPhase({ state, socket, myId, keyword, isSpectating, liarNickname }: DrawingPhaseProps) {
  const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
  const isMyTurn = currentDrawerId === myId;
  const currentDrawer = state.players.find((p) => p.id === currentDrawerId);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 상단 정보 바 */}
      <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-border/50 bg-card/60 neon-glow-cyan w-full max-w-[520px]">
        {/* 그리는 사람 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">🎨</span>
          <div className="min-w-0">
            <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase leading-none">그리는 중</div>
            <div className={`text-sm font-bold truncate ${isMyTurn ? "text-primary" : "text-foreground"}`}>
              {currentDrawer?.nickname}{isMyTurn && " (나)"}
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-border shrink-0" />

        {/* 주제 + 제시어/라이어 */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase leading-none">
            주제: {state.category}
          </div>
          {isSpectating && liarNickname ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-display font-bold text-primary truncate">{keyword}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-display font-medium shrink-0">🎭 라이어: {liarNickname}</span>
            </div>
          ) : keyword ? (
            <div className="text-sm font-display font-bold text-primary text-glow-cyan truncate">{keyword}</div>
          ) : (
            <div className="text-sm font-display font-bold text-accent">라이어</div>
          )}
        </div>

        <div className="w-px h-8 bg-border shrink-0" />

        {/* 턴 진행 */}
        <div className="text-center shrink-0">
          <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase leading-none">턴</div>
          <div className="text-sm font-mono font-bold tabular-nums">{state.currentDrawerIndex + 1}/{state.drawOrder.length}</div>
        </div>

        <div className="w-px h-8 bg-border shrink-0" />

        {/* 타이머 */}
        <TurnTimer turnStartedAt={state.turnStartedAt} drawTimeSeconds={state.drawTimeSeconds} />
      </div>

      {/* Key by currentDrawerIndex so the sub-component remounts and resets state */}
      <DrawingTurn
        key={state.currentDrawerIndex}
        state={state}
        socket={socket}
        myId={myId}
        isMyTurn={isMyTurn && !isSpectating}
        currentDrawerId={currentDrawerId}
      />

      {!isMyTurn && !isSpectating && (
        <div className="text-xs text-muted-foreground">다른 플레이어가 그리는 것을 관전 중입니다</div>
      )}
    </div>
  );
}

function TurnTimer({ turnStartedAt, drawTimeSeconds }: { turnStartedAt: number | null; drawTimeSeconds: number }) {
  const [remainingTime, setRemainingTime] = useState(drawTimeSeconds);

  useEffect(() => {
    if (!turnStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = getServerElapsed(turnStartedAt) / 1000;
      setRemainingTime(Math.max(0, drawTimeSeconds - elapsed));
    }, 200);
    return () => clearInterval(interval);
  }, [turnStartedAt, drawTimeSeconds]);

  const pct = (remainingTime / drawTimeSeconds) * 100;
  const isUrgent = remainingTime <= 5;
  const isWarning = remainingTime <= 10 && !isUrgent;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0 min-w-[52px]">
      <div className={`text-xl font-mono font-black tabular-nums leading-none ${
        isUrgent ? "text-accent animate-pulse" : isWarning ? "text-neon-yellow" : "text-foreground"
      }`}>
        {Math.ceil(remainingTime)}
      </div>
      <div className="text-[10px] font-display text-muted-foreground tracking-wider">초</div>
      <div className="w-full h-0.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            isUrgent ? "bg-accent" : isWarning ? "bg-neon-yellow" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface DrawingTurnProps {
  state: LiarDrawingPublicState;
  socket: GameSocket;
  myId: string;
  isMyTurn: boolean;
  currentDrawerId: string;
}

function DrawingTurn({ state, socket, isMyTurn, currentDrawerId }: DrawingTurnProps) {
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<PenColor>("black");
  const [thickness, setThickness] = useState<PenThickness>(5);
  const [livePoints, setLivePoints] = useState<DrawPoint[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const myCanvasPoints = state.canvases[currentDrawerId] || [];

  // Listen for real-time draw points and clear-canvas events
  useEffect(() => {
    const handleClearCanvasEvent = (data: { playerId: string }) => {
      if (data.playerId === currentDrawerId) {
        setLivePoints([]);
      }
    };

    socket.on("game:clear-canvas", handleClearCanvasEvent);

    if (!isMyTurn) {
      const handleDrawPoints = (data: { playerId: string; points: DrawPoint[] }) => {
        if (data.playerId === currentDrawerId) {
          setLivePoints((prev) => [...prev, ...data.points]);
        }
      };
      socket.on("game:draw-points", handleDrawPoints);
      return () => {
        socket.off("game:draw-points", handleDrawPoints);
        socket.off("game:clear-canvas", handleClearCanvasEvent);
      };
    }

    return () => {
      socket.off("game:clear-canvas", handleClearCanvasEvent);
    };
  }, [socket, isMyTurn, currentDrawerId]);

  const handleDraw = useCallback(
    (points: DrawPoint[]) => {
      if (!isMyTurn) return;
      socket.emit("game:draw-points", points);
      // Accumulate locally so drawer's displayPoints stays in sync
      setLivePoints((prev) => [...prev, ...points]);
    },
    [isMyTurn, socket],
  );

  const handleClearCanvas = useCallback(() => {
    if (!isMyTurn) return;
    socket.emit("game:move", { type: "clear-canvas" });
    setLivePoints([]);
  }, [isMyTurn, socket]);

  const handleCompleteTurn = useCallback(
    (skip: boolean) => {
      if (!isMyTurn) return;
      socket.emit("game:move", { type: "complete-turn", skip });
      if (skip) setLivePoints([]);
      setShowCompleteDialog(false);
    },
    [isMyTurn, socket],
  );

  const displayPoints = [...myCanvasPoints, ...livePoints];

  return (
    <div className="flex gap-4 items-start">
      <DrawingCanvas
        points={displayPoints}
        isMyTurn={isMyTurn}
        tool={tool}
        color={color}
        thickness={thickness}
        onDraw={handleDraw}
      />
      {isMyTurn && (
        <div className="flex flex-col gap-2">
          <DrawingToolbar
            tool={tool}
            color={color}
            thickness={thickness}
            onToolChange={setTool}
            onColorChange={setColor}
            onThicknessChange={setThickness}
            onClearCanvas={handleClearCanvas}
          />
          <button
            onClick={() => setShowCompleteDialog(true)}
            className="px-3 py-1.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            그리기 완료
          </button>
        </div>
      )}

      {showCompleteDialog && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowCompleteDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h2 className="text-lg font-bold mb-2">그리기를 마치시겠습니까?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                완료: 그림을 유지하고 턴을 넘깁니다.
                <br />
                스킵: 그림을 지우고 턴을 넘깁니다.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCompleteDialog(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleCompleteTurn(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  스킵
                </button>
                <button
                  onClick={() => handleCompleteTurn(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  완료
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
