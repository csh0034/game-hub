"use client";

import { useRef, useEffect, useCallback } from "react";
import type { DrawPoint, DrawTool, PenColor, PenThickness } from "@game-hub/shared-types";

const CANVAS_SIZE = 400;

const COLOR_MAP: Record<PenColor, string> = {
  black: "#000000",
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#facc15",
  orange: "#f97316",
  purple: "#a855f7",
  white: "#ffffff",
};

function drawPoints(ctx: CanvasRenderingContext2D, points: DrawPoint[]) {
  for (const point of points) {
    if (point.isStart) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }

    if (point.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = point.thickness * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = COLOR_MAP[point.color];
      ctx.lineWidth = point.thickness;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

interface DrawingCanvasProps {
  points: DrawPoint[];
  isMyTurn: boolean;
  tool: DrawTool;
  color: PenColor;
  thickness: PenThickness;
  onDraw?: (points: DrawPoint[]) => void;
  readOnly?: boolean;
  size?: number;
}

export function DrawingCanvas({
  points,
  isMyTurn,
  tool,
  color,
  thickness,
  onDraw,
  readOnly,
  size = CANVAS_SIZE,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const batchRef = useRef<DrawPoint[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redraw all points when points array changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawPoints(ctx, points);
  }, [points]);

  const flushBatch = useCallback(() => {
    if (batchRef.current.length > 0 && onDraw) {
      onDraw([...batchRef.current]);
      batchRef.current = [];
    }
  }, [onDraw]);

  useEffect(() => {
    if (isMyTurn && !readOnly) {
      timerRef.current = setInterval(flushBatch, 50);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      flushBatch();
    };
  }, [isMyTurn, readOnly, flushBatch]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scale, y: (touch.clientY - rect.top) * scale };
    }
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isMyTurn || readOnly) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e);
    if (!pos) return;

    const point: DrawPoint = { x: pos.x, y: pos.y, tool, color, thickness, isStart: true };
    batchRef.current.push(point);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || !isMyTurn || readOnly) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;

    const point: DrawPoint = { x: pos.x, y: pos.y, tool, color, thickness, isStart: false };
    batchRef.current.push(point);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = thickness * 3;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = COLOR_MAP[color];
        ctx.lineWidth = thickness;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const handleEnd = () => {
    isDrawingRef.current = false;
    flushBatch();
  };

  const canDraw = isMyTurn && !readOnly;

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      style={{ width: size, height: size }}
      className={`border border-border rounded bg-white ${canDraw ? "cursor-crosshair" : "cursor-default"}`}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  );
}
