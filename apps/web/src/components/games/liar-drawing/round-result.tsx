"use client";

import { useState, useEffect } from "react";
import type { LiarDrawingPublicState } from "@game-hub/shared-types";

interface RoundResultProps {
  state: LiarDrawingPublicState;
}

const NEXT_ROUND_SECONDS = 10;

export function RoundResult({ state }: RoundResultProps) {
  const [countdown, setCountdown] = useState(NEXT_ROUND_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const liar = state.players.find((p) => p.id === state.liarId);
  const accused = state.accusedPlayerId ? state.players.find((p) => p.id === state.accusedPlayerId) : null;
  const liarCaught = state.accusedPlayerId === state.liarId;

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="text-lg font-bold">라운드 {state.roundNumber} 결과</div>

      <div className="space-y-2 text-center">
        <div>
          라이어: <span className="font-bold text-destructive">{liar?.nickname}</span>
        </div>

        {accused ? (
          <div>
            지목된 플레이어: <span className="font-bold">{accused.nickname}</span>
            {liarCaught ? (
              <span className="ml-1 text-green-500">- 라이어 적중!</span>
            ) : (
              <span className="ml-1 text-destructive">- 오답!</span>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground">동률로 라이어 지목 실패</div>
        )}

        {liarCaught && state.liarGuess !== null && (
          <div>
            라이어의 추측: <span className="font-bold">&quot;{state.liarGuess || "(미입력)"}&quot;</span>
            {state.liarGuessCorrect ? (
              <span className="ml-1 text-destructive">- 정답! 라이어 역전!</span>
            ) : (
              <span className="ml-1 text-green-500">- 오답!</span>
            )}
          </div>
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
                  {player.id === state.liarId && <span className="text-destructive ml-1">(라이어)</span>}
                </span>
                <span className={roundScore > 0 ? "text-primary font-bold" : "text-muted-foreground"}>
                  {roundScore > 0 ? `+${roundScore}` : "0"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">다음 라운드까지 <span className="font-mono font-bold">{countdown}초</span></div>
    </div>
  );
}
