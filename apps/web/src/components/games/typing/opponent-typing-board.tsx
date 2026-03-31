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
    const board = el.offsetParent as HTMLElement | null;
    if (!board) return;
    const boardH = board.clientHeight;
    const now = Date.now();
    const elapsed = (now - word.spawnedAt) / 1000;
    const total = word.fallDurationMs / 1000;
    const remaining = Math.max(total - elapsed, 0);
    const startY = Math.min(elapsed / total, 1) * boardH;

    const anim = el.animate(
      [
        { transform: `translateX(-50%) translateY(${startY}px)` },
        { transform: `translateX(-50%) translateY(${boardH}px)` },
      ],
      { duration: remaining * 1000, fill: "forwards", easing: "linear" },
    );
    return () => anim.cancel();
  }, [word.spawnedAt, word.fallDurationMs]);

  return (
    <div
      ref={divRef}
      className="absolute top-0 pointer-events-none"
      style={{ left: `${word.x}%`, transform: "translateX(-50%)" }}
    >
      <span className="inline-block bg-gradient-to-b from-sky-400 to-blue-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap shadow-[0_0_6px_rgba(56,189,248,0.3)]">
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
    <div className="flex flex-col gap-1.5">
      <div className="relative bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-700/40 rounded-xl overflow-hidden w-44 h-48 shadow-inner">
        {/* 위험 구역 */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-red-900/20 to-transparent pointer-events-none z-[1]" />

        {!isDead &&
          words.map((word) => <MiniFallingWord key={word.id} word={word} />)}

        {isDead && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-10">
            <span className="text-sm font-bold text-red-400">탈락</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-1.5 text-[10px]">
        <span className={`font-medium truncate max-w-[70px] ${isDead ? "line-through text-slate-500" : "text-slate-300"}`}>
          {player.nickname}
        </span>
        <div className="flex items-center gap-1.5 tabular-nums shrink-0">
          <span className="font-semibold text-sky-400">{player.score.toLocaleString()}</span>
          <span>
            {player.lives > 0 ? `❤️x${player.lives}` : "💀"}
          </span>
          {player.combo >= 3 && (
            <span className="text-amber-400 font-bold">{player.combo}x</span>
          )}
        </div>
      </div>
    </div>
  );
});
