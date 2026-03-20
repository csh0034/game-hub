"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { LiarDrawingPublicState, DrawPoint, DrawTool, PenColor, PenThickness } from "@game-hub/shared-types";
import type { GameSocket } from "@/lib/socket";
import { DrawingCanvas } from "./drawing-canvas";
import { DrawingToolbar } from "./drawing-toolbar";

interface DrawingPhaseProps {
  state: LiarDrawingPublicState;
  socket: GameSocket;
  myId: string;
}

export function DrawingPhase({ state, socket, myId }: DrawingPhaseProps) {
  const currentDrawerId = state.drawOrder[state.currentDrawerIndex];
  const isMyTurn = currentDrawerId === myId;
  const currentDrawer = state.players.find((p) => p.id === currentDrawerId);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <div className="text-sm">
          그리는 중: <span className="font-bold">{currentDrawer?.nickname}</span>
          {isMyTurn && <span className="ml-1 text-primary">(내 차례)</span>}
        </div>
        <TurnTimer turnStartedAt={state.turnStartedAt} drawTimeSeconds={state.drawTimeSeconds} />
        <div className="text-xs text-muted-foreground">
          {state.currentDrawerIndex + 1} / {state.drawOrder.length}
        </div>
      </div>

      {/* Key by currentDrawerIndex so the sub-component remounts and resets state */}
      <DrawingTurn
        key={state.currentDrawerIndex}
        state={state}
        socket={socket}
        myId={myId}
        isMyTurn={isMyTurn}
        currentDrawerId={currentDrawerId}
      />

      {!isMyTurn && (
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
  const accumulatedRef = useRef<DrawPoint[]>([]);
  const myCanvasPoints = state.canvases[currentDrawerId] || [];

  // Listen for real-time draw points from other players
  useEffect(() => {
    if (isMyTurn) return;

    const handleDrawPoints = (data: { playerId: string; points: DrawPoint[] }) => {
      if (data.playerId === currentDrawerId) {
        accumulatedRef.current = [...accumulatedRef.current, ...data.points];
        setLivePoints([...accumulatedRef.current]);
      }
    };

    socket.on("game:draw-points", handleDrawPoints);
    return () => {
      socket.off("game:draw-points", handleDrawPoints);
    };
  }, [socket, isMyTurn, currentDrawerId]);

  const handleDraw = useCallback(
    (points: DrawPoint[]) => {
      if (!isMyTurn) return;
      socket.emit("game:draw-points", points);
    },
    [isMyTurn, socket],
  );

  const handleClearCanvas = useCallback(() => {
    if (!isMyTurn) return;
    socket.emit("game:move", { type: "clear-canvas" });
  }, [isMyTurn, socket]);

  const displayPoints = isMyTurn ? myCanvasPoints : [...myCanvasPoints, ...livePoints];

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
