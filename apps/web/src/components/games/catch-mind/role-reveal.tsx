"use client";

import { useState, useEffect } from "react";
import type { CatchMindPrivateState } from "@game-hub/shared-types";

interface RoleRevealProps {
  privateState: CatchMindPrivateState | null;
  drawerNickname: string;
  isDrawer: boolean;
  isSpectating?: boolean;
  roundNumber: number;
  totalRounds: number;
  keywordLength: number | null;
}

export function RoleReveal({ privateState, drawerNickname, isDrawer, isSpectating, roundNumber, totalRounds, keywordLength }: RoleRevealProps) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCountdown(Math.max(0, 3 - elapsed));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 phase-fade-up">
      {/* 라운드 배지 */}
      <div className="px-4 py-1.5 rounded-full border border-border bg-card/60 text-xs font-display font-medium tracking-wider text-muted-foreground uppercase">
        Round {roundNumber} / {totalRounds}
      </div>

      {/* 역할 카드 */}
      {isSpectating ? (
        /* 관전자: 출제자 + 제시어 모두 표시 */
        <div className="phase-scale-in relative px-10 py-8 rounded-2xl border border-neon-purple/30 bg-neon-purple/5 text-center">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg border-neon-purple/40" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg border-neon-purple/40" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg border-neon-purple/40" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg border-neon-purple/40" />
          <div className="space-y-3">
            <div className="text-4xl">👁️</div>
            <div className="text-xs font-display text-muted-foreground tracking-wider uppercase">관전 중</div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="text-center">
                <div className="text-[10px] font-display text-muted-foreground tracking-wider uppercase">출제자</div>
                <div className="text-sm font-bold text-neon-purple">{drawerNickname}</div>
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
          isDrawer
            ? "border-primary/40 bg-primary/5 neon-pulse"
            : "border-neon-purple/30 bg-neon-purple/5"
        }`}>
          {/* 장식 코너 */}
          <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg ${isDrawer ? "border-primary/60" : "border-neon-purple/40"}`} />
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg ${isDrawer ? "border-primary/60" : "border-neon-purple/40"}`} />
          <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg ${isDrawer ? "border-primary/60" : "border-neon-purple/40"}`} />
          <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg ${isDrawer ? "border-primary/60" : "border-neon-purple/40"}`} />

          {isDrawer ? (
            <div className="space-y-3">
              <div className="text-4xl">🎨</div>
              <div className="text-2xl font-display font-bold text-primary text-glow-cyan">출제자</div>
              <div className="text-xs font-display text-muted-foreground tracking-wider uppercase mb-1">제시어</div>
              <div className="text-3xl font-display font-bold text-primary text-glow-cyan">{privateState?.keyword}</div>
              <div className="text-xs text-muted-foreground mt-1">그림으로 표현하세요 (글자/숫자 금지)</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl">💬</div>
              <div className="text-lg text-muted-foreground">
                출제자: <span className="font-bold text-foreground">{drawerNickname}</span>
              </div>
              <div className="text-xl font-display font-bold">채팅으로 정답을 맞추세요!</div>
              {keywordLength !== null && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  {Array.from({ length: keywordLength }, (_, i) => (
                    <div key={i} className="w-6 h-6 rounded border border-primary/30 bg-primary/5 flex items-center justify-center text-xs text-primary font-bold">?</div>
                  ))}
                </div>
              )}
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
