"use client";

import { useState, useEffect } from "react";
import type { LiarDrawingPrivateState } from "@game-hub/shared-types";

interface RoleRevealProps {
  privateState: LiarDrawingPrivateState | null;
  category: string;
  roundNumber: number;
  totalRounds: number;
}

export function RoleReveal({ privateState, category, roundNumber, totalRounds }: RoleRevealProps) {
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

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      <div className="text-sm text-muted-foreground">
        라운드 {roundNumber} / {totalRounds}
      </div>

      <div className="text-center space-y-4">
        <div className="text-lg text-muted-foreground">
          주제: <span className="font-bold text-foreground">{category}</span>
        </div>

        {isLiar ? (
          <div className="space-y-2">
            <div className="text-3xl font-display font-bold text-accent text-glow-pink">당신은 라이어입니다!</div>
            <div className="text-sm text-muted-foreground">제시어를 모르지만 주제에 맞게 그려야 합니다</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">제시어</div>
            <div className="text-3xl font-display font-bold text-primary text-glow-cyan">{privateState?.keyword}</div>
          </div>
        )}
      </div>

      <div className="text-2xl font-mono font-bold text-primary">{countdown}</div>
      <div className="text-sm text-muted-foreground">곧 그리기가 시작됩니다...</div>
    </div>
  );
}
