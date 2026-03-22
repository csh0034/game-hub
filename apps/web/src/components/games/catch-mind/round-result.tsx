"use client";

import { useState, useEffect } from "react";
import type { CatchMindPublicState } from "@game-hub/shared-types";

interface RoundResultProps {
  state: CatchMindPublicState;
}

const NEXT_ROUND_SECONDS = 10;

export function RoundResult({ state }: RoundResultProps) {
  const isLastRound = state.roundNumber >= state.totalRounds;
  const [countdown, setCountdown] = useState(NEXT_ROUND_SECONDS);

  useEffect(() => {
    if (isLastRound) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLastRound]);

  const drawer = state.players.find((p) => p.id === state.drawerId);
  const firstGuesser = state.firstGuesserId ? state.players.find((p) => p.id === state.firstGuesserId) : null;

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="text-lg font-bold">라운드 {state.roundNumber} 결과</div>

      <div className="space-y-2 text-center">
        <div>
          정답: <span className="font-bold text-primary text-xl">{state.keyword}</span>
        </div>
        <div>
          출제자: <span className="font-bold">{drawer?.nickname}</span>
        </div>
        {firstGuesser ? (
          <div className="text-green-500">
            가장 먼저 맞춘 사람: <span className="font-bold">{firstGuesser.nickname}</span>
          </div>
        ) : (
          <div className="text-destructive">아무도 맞추지 못했습니다</div>
        )}
      </div>

      <div className="border border-border rounded-lg p-3 min-w-[200px]">
        <div className="text-sm font-medium mb-2 text-center">라운드 점수</div>
        <div className="space-y-1">
          {state.players.map((player) => {
            const roundScore = state.roundScores[player.id] || 0;
            return (
              <div key={player.id} className="flex justify-between text-sm">
                <span>
                  {player.nickname}
                  {player.id === state.drawerId && <span className="text-primary ml-1">(출제자)</span>}
                  {player.id === state.firstGuesserId && <span className="text-green-500 ml-1">(1등)</span>}
                </span>
                <span className={roundScore > 0 ? "text-primary font-bold" : roundScore < 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                  {roundScore > 0 ? `+${roundScore}` : roundScore < 0 ? `${roundScore}` : "0"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isLastRound ? (
        <div className="text-sm text-muted-foreground">최종 결과를 집계 중...</div>
      ) : (
        <div className="text-sm text-muted-foreground">다음 라운드까지 <span className="font-mono font-bold">{countdown}초</span></div>
      )}
    </div>
  );
}
