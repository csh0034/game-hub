"use client";

import { useState, useEffect, useCallback } from "react";
import type { CatchMindPublicState, DrawPoint, DrawTool, PenColor, PenThickness } from "@game-hub/shared-types";
import { getServerElapsed, type GameSocket } from "@/lib/socket";
import { DrawingCanvas } from "@/components/games/liar-drawing/drawing-canvas";
import { DrawingToolbar } from "@/components/games/liar-drawing/drawing-toolbar";

interface DrawingPhaseProps {
  state: CatchMindPublicState;
  socket: GameSocket;
  myId: string;
  keyword: string | null;
  isSpectating?: boolean;
}

export function DrawingPhase({ state, socket, myId, keyword, isSpectating }: DrawingPhaseProps) {
  const isDrawer = state.drawerId === myId;
  const drawer = state.players.find((p) => p.id === state.drawerId);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 상단 정보 바 */}
      <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-border/50 bg-card/60 neon-glow-cyan w-full max-w-[460px]">
        {/* 출제자 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">🎨</span>
          <div className="min-w-0">
            <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase leading-none">출제자</div>
            <div className={`text-sm font-bold truncate ${isDrawer ? "text-primary" : "text-foreground"}`}>
              {drawer?.nickname}{isDrawer && " (나)"}
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-border shrink-0" />

        {/* 제시어 / 힌트 */}
        <div className="flex-1 min-w-0">
          {isDrawer && !isSpectating ? (
            <div>
              <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase leading-none">제시어</div>
              <div className="text-sm font-display font-bold text-primary text-glow-cyan truncate">{keyword}</div>
            </div>
          ) : !isSpectating ? (
            <div>
              {state.showCharHint && state.keywordLength !== null ? (
                <>
                  <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase leading-none">글자수</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: state.keywordLength }, (_, i) => (
                      <div key={i} className="w-5 h-5 rounded border border-primary/30 bg-primary/5 flex items-center justify-center text-[10px] text-primary font-bold">?</div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">채팅으로 정답을 맞추세요!</div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase leading-none">제시어</div>
              <div className="text-sm font-display font-bold text-primary truncate">{keyword ?? "?"}</div>
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-border shrink-0" />

        {/* 타이머 */}
        <TurnTimer turnStartedAt={state.turnStartedAt} drawTimeSeconds={state.drawTimeSeconds} />
      </div>

      <DrawingArea state={state} socket={socket} isDrawer={isDrawer && !isSpectating} />
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
      {/* 미니 프로그레스 */}
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

interface DrawingAreaProps {
  state: CatchMindPublicState;
  socket: GameSocket;
  isDrawer: boolean;
}

function DrawingArea({ state, socket, isDrawer }: DrawingAreaProps) {
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<PenColor>("black");
  const [thickness, setThickness] = useState<PenThickness>(5);
  const [livePoints, setLivePoints] = useState<DrawPoint[]>([]);

  useEffect(() => {
    const handleClearCanvasEvent = (data: { playerId: string }) => {
      if (data.playerId === state.drawerId) {
        setLivePoints([]);
      }
    };

    socket.on("game:clear-canvas", handleClearCanvasEvent);

    if (!isDrawer) {
      const handleDrawPoints = (data: { playerId: string; points: DrawPoint[] }) => {
        if (data.playerId === state.drawerId) {
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
  }, [socket, isDrawer, state.drawerId]);

  const handleDraw = useCallback(
    (points: DrawPoint[]) => {
      if (!isDrawer) return;
      socket.emit("game:draw-points", points);
      setLivePoints((prev) => [...prev, ...points]);
    },
    [isDrawer, socket],
  );

  const handleClearCanvas = useCallback(() => {
    if (!isDrawer) return;
    socket.emit("game:move", { type: "clear-canvas" });
    setLivePoints([]);
  }, [isDrawer, socket]);

  const displayPoints = [...state.canvas, ...livePoints];

  return (
    <div className="flex gap-4 items-start">
      <DrawingCanvas
        points={displayPoints}
        isMyTurn={isDrawer}
        tool={tool}
        color={color}
        thickness={thickness}
        onDraw={handleDraw}
      />
      {isDrawer && (
        <DrawingToolbar
          tool={tool}
          color={color}
          thickness={thickness}
          onToolChange={setTool}
          onColorChange={setColor}
          onThicknessChange={setThickness}
          onClearCanvas={handleClearCanvas}
        />
      )}
    </div>
  );
}
