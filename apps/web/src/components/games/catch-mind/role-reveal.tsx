"use client";

import { useState, useEffect } from "react";
import type { CatchMindPrivateState } from "@game-hub/shared-types";

interface RoleRevealProps {
  privateState: CatchMindPrivateState | null;
  drawerNickname: string;
  isDrawer: boolean;
  roundNumber: number;
  totalRounds: number;
  keywordLength: number | null;
}

export function RoleReveal({ privateState, drawerNickname, isDrawer, roundNumber, totalRounds, keywordLength }: RoleRevealProps) {
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
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      <div className="text-sm text-muted-foreground">
        라운드 {roundNumber} / {totalRounds}
      </div>

      <div className="text-center space-y-4">
        {isDrawer ? (
          <div className="space-y-2">
            <div className="text-2xl font-bold text-primary">당신이 출제자입니다!</div>
            <div className="text-sm text-muted-foreground">제시어</div>
            <div className="text-3xl font-bold text-primary">{privateState?.keyword}</div>
            <div className="text-sm text-muted-foreground">그림으로 표현하세요 (글자/숫자 금지)</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-lg text-muted-foreground">
              출제자: <span className="font-bold text-foreground">{drawerNickname}</span>
            </div>
            <div className="text-2xl font-bold">채팅으로 정답을 맞추세요!</div>
            {keywordLength !== null && (
              <div className="text-sm text-muted-foreground">
                글자수: <span className="font-bold text-foreground tracking-widest">{"○".repeat(keywordLength)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-2xl font-mono font-bold text-muted-foreground">{countdown}</div>
      <div className="text-sm text-muted-foreground">곧 그리기가 시작됩니다...</div>
    </div>
  );
}
