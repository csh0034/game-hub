"use client";

import { memo, useEffect, useRef } from "react";
import type { TypingWord, TypingPlayerState } from "@game-hub/shared-types";

interface OpponentTypingBoardProps {
  words: TypingWord[];
  player: TypingPlayerState;
}

function MiniFallingWord({ word }: { word: TypingWord }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const now = Date.now();
    const elapsed = (now - word.spawnedAt) / 1000;
    const total = word.fallDurationMs / 1000;
    const remaining = Math.max(total - elapsed, 0);
    const startPct = Math.min((elapsed / total) * 100, 100);
    el.style.top = `${startPct}%`;
    el.style.animation = `typing-fall ${remaining}s linear forwards`;
  }, [word.spawnedAt, word.fallDurationMs]);

  return (
    <div
      ref={divRef}
      className="absolute pointer-events-none"
      style={{ left: `${word.x}%`, transform: "translateX(-50%)" }}
    >
      <span className="bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-normal whitespace-nowrap">
        {word.text}
      </span>
    </div>
  );
}

export const OpponentTypingBoard = memo(function OpponentTypingBoard({
  words,
  player,
}: OpponentTypingBoardProps) {
  const isDead = player.status === "gameover";

  return (
    <div className="flex flex-col gap-1">
      <div className="relative bg-card border border-border rounded-lg overflow-hidden w-44 h-48">
        {!isDead &&
          words.map((word) => <MiniFallingWord key={word.id} word={word} />)}

        {isDead && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <span className="text-sm font-bold text-destructive">탈락</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-1 text-[10px]">
        <span className={`font-medium truncate max-w-[70px] ${isDead ? "line-through opacity-60" : ""}`}>
          {player.nickname}
        </span>
        <div className="flex items-center gap-1.5 tabular-nums shrink-0">
          <span className="font-semibold text-primary">{player.score.toLocaleString()}</span>
          <span>
            {player.lives > 0 ? `❤️x${player.lives}` : "💀"}
          </span>
          {player.combo >= 3 && (
            <span className="text-amber-500 font-bold">{player.combo}x</span>
          )}
        </div>
      </div>
    </div>
  );
});
