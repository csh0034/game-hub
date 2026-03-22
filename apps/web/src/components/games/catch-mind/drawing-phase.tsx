"use client";

import { useState, useEffect, useCallback } from "react";
import type { CatchMindPublicState, DrawPoint, DrawTool, PenColor, PenThickness } from "@game-hub/shared-types";
import type { GameSocket } from "@/lib/socket";
import { DrawingCanvas } from "@/components/games/liar-drawing/drawing-canvas";
import { DrawingToolbar } from "@/components/games/liar-drawing/drawing-toolbar";

interface DrawingPhaseProps {
  state: CatchMindPublicState;
  socket: GameSocket;
  myId: string;
  keyword: string | null;
}

export function DrawingPhase({ state, socket, myId, keyword }: DrawingPhaseProps) {
  const isDrawer = state.drawerId === myId;
  const drawer = state.players.find((p) => p.id === state.drawerId);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <div className="text-sm">
          출제자: <span className="font-bold">{drawer?.nickname}</span>
          {isDrawer && <span className="ml-1 text-primary">(나)</span>}
        </div>
        <TurnTimer turnStartedAt={state.turnStartedAt} drawTimeSeconds={state.drawTimeSeconds} />
      </div>

      {isDrawer ? (
        <div className="text-sm">
          제시어: <span className="font-bold text-primary">{keyword}</span>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {state.showCharHint && state.keywordLength !== null ? (
            <>힌트: <span className="font-bold text-foreground">{state.keywordLength}글자</span></>
          ) : (
            "채팅으로 정답을 맞추세요!"
          )}
        </div>
      )}

      <DrawingArea state={state} socket={socket} isDrawer={isDrawer} />
    </div>
  );
}

function TurnTimer({ turnStartedAt, drawTimeSeconds }: { turnStartedAt: number | null; drawTimeSeconds: number }) {
  const [remainingTime, setRemainingTime] = useState(drawTimeSeconds);

  useEffect(() => {
    if (!turnStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      setRemainingTime(Math.max(0, drawTimeSeconds - elapsed));
    }, 200);
    return () => clearInterval(interval);
  }, [turnStartedAt, drawTimeSeconds]);

  return (
    <div className="text-sm font-mono">
      <span className={remainingTime <= 5 ? "text-destructive font-bold" : ""}>{Math.ceil(remainingTime)}초</span>
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
