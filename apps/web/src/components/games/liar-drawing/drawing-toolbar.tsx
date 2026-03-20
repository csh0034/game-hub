"use client";

import type { DrawTool, PenColor, PenThickness } from "@game-hub/shared-types";

const COLORS: { value: PenColor; label: string; css: string }[] = [
  { value: "black", label: "검정", css: "bg-black" },
  { value: "red", label: "빨강", css: "bg-red-500" },
  { value: "blue", label: "파랑", css: "bg-blue-500" },
  { value: "green", label: "초록", css: "bg-green-500" },
  { value: "yellow", label: "노랑", css: "bg-yellow-400" },
  { value: "orange", label: "주황", css: "bg-orange-500" },
  { value: "purple", label: "보라", css: "bg-purple-500" },
  { value: "white", label: "흰색", css: "bg-white border border-gray-300" },
];

const THICKNESSES: { value: PenThickness; label: string; size: string }[] = [
  { value: 2, label: "얇음", size: "w-1.5 h-1.5" },
  { value: 5, label: "보통", size: "w-3 h-3" },
  { value: 10, label: "굵음", size: "w-5 h-5" },
];

interface DrawingToolbarProps {
  tool: DrawTool;
  color: PenColor;
  thickness: PenThickness;
  onToolChange: (tool: DrawTool) => void;
  onColorChange: (color: PenColor) => void;
  onThicknessChange: (thickness: PenThickness) => void;
  onClearCanvas: () => void;
  disabled?: boolean;
}

export function DrawingToolbar({
  tool,
  color,
  thickness,
  onToolChange,
  onColorChange,
  onThicknessChange,
  onClearCanvas,
  disabled,
}: DrawingToolbarProps) {
  return (
    <div className={`flex flex-col gap-2 p-2 bg-card border border-border rounded-lg ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex gap-1">
        <button
          onClick={() => onToolChange("pen")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            tool === "pen" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          펜
        </button>
        <button
          onClick={() => onToolChange("eraser")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            tool === "eraser" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          지우개
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => onColorChange(c.value)}
            className={`w-6 h-6 rounded-full ${c.css} ${
              color === c.value ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""
            }`}
            title={c.label}
          />
        ))}
      </div>

      <div className="flex gap-1 items-center">
        {THICKNESSES.map((t) => (
          <button
            key={t.value}
            onClick={() => onThicknessChange(t.value)}
            className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
              thickness === t.value ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary"
            }`}
            title={t.label}
          >
            <div className={`${t.size} rounded-full bg-foreground`} />
          </button>
        ))}
      </div>

      <button
        onClick={onClearCanvas}
        className="px-3 py-1.5 rounded text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
      >
        전체 지우기
      </button>
    </div>
  );
}
