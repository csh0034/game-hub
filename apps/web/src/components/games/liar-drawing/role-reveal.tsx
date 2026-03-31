"use client";

import { useState, useEffect } from "react";
import type { LiarDrawingPrivateState } from "@game-hub/shared-types";

interface RoleRevealProps {
  privateState: LiarDrawingPrivateState | null;
  category: string;
  roundNumber: number;
  totalRounds: number;
  isSpectating?: boolean;
  liarNickname?: string;
}

export function RoleReveal({ privateState, category, roundNumber, totalRounds, isSpectating, liarNickname }: RoleRevealProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCountdown(Math.max(0, 5 - elapsed));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const isLiar = privateState?.role === "liar";
  const isSpectatorRole = isSpectating || privateState?.role === "spectator";

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 phase-fade-up">
      {/* 라운드 배지 */}
      <div className="px-4 py-1.5 rounded-full border border-border bg-card/60 text-xs font-display font-medium tracking-wider text-muted-foreground uppercase">
        Round {roundNumber} / {totalRounds}
      </div>

      {/* 주제 */}
      <div className="text-sm text-muted-foreground">
        주제: <span className="font-bold text-foreground">{category}</span>
      </div>

      {/* 역할 카드 */}
      {isSpectatorRole ? (
        /* 관전자: 라이어 + 제시어 모두 표시 */
        <div className="phase-scale-in relative px-10 py-8 rounded-2xl border border-neon-purple/30 bg-neon-purple/5 text-center">
          <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg border-neon-purple/40`} />
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg border-neon-purple/40`} />
          <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg border-neon-purple/40`} />
          <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg border-neon-purple/40`} />
          <div className="space-y-3">
            <div className="text-4xl">👁️</div>
            <div className="text-xs font-display text-muted-foreground tracking-wider uppercase">관전 중</div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="text-center">
                <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase">라이어</div>
                <div className="text-sm font-bold text-accent">{liarNickname ?? "?"}</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase">제시어</div>
                <div className="text-sm font-bold text-primary">{privateState?.keyword ?? "?"}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`phase-scale-in relative px-10 py-8 rounded-2xl border text-center ${
          isLiar
            ? "border-accent/40 bg-accent/5 neon-pulse-pink"
            : "border-primary/40 bg-primary/5 neon-pulse"
        }`}>
          {/* 장식 코너 */}
          <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg ${isLiar ? "border-accent/60" : "border-primary/60"}`} />
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg ${isLiar ? "border-accent/60" : "border-primary/60"}`} />
          <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg ${isLiar ? "border-accent/60" : "border-primary/60"}`} />
          <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg ${isLiar ? "border-accent/60" : "border-primary/60"}`} />

          {isLiar ? (
            <div className="space-y-3">
              <div className="text-4xl">🎭</div>
              <div className="text-2xl font-display font-bold text-accent text-glow-pink">LIAR</div>
              <div className="text-sm text-muted-foreground max-w-[200px]">제시어를 모르지만<br />주제에 맞게 그려야 합니다</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl">🎨</div>
              <div className="text-xs font-display text-muted-foreground tracking-wider uppercase">제시어</div>
              <div className="text-3xl font-display font-bold text-primary text-glow-cyan">{privateState?.keyword}</div>
            </div>
          )}
        </div>
      )}

      {/* 카운트다운 */}
      <div className="flex flex-col items-center gap-2">
        <div
          key={countdown}
          className="text-4xl font-mono font-black text-primary tabular-nums"
          style={{ animation: "countdown-tick 0.5s ease-out" }}
        >
          {countdown}
        </div>
        <div className="text-xs text-muted-foreground font-display tracking-wider">곧 그리기가 시작됩니다</div>
      </div>
    </div>
  );
}
