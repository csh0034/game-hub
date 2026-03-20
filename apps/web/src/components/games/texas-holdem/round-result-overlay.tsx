"use client";

import { useState, useEffect } from "react";
import type { Card } from "@game-hub/shared-types";
import type { RoundResult } from "@/stores/game-store";
import { CardDisplay } from "./card-display";

export function RoundResultOverlay({
  roundResult,
  players,
}: {
  roundResult: RoundResult;
  players: { id: string; nickname: string }[];
}) {
  const [countdown, setCountdown] = useState(Math.ceil(roundResult.nextRoundIn / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getNickname = (playerId: string) => {
    return players.find((p) => p.id === playerId)?.nickname || playerId;
  };

  return (
    <div className="absolute inset-0 bg-black/60 rounded-[50%] flex items-center justify-center z-10">
      <div className="bg-card border border-border rounded-2xl px-8 py-6 text-center shadow-2xl min-w-[320px]">
        <h3 className="text-lg font-bold text-yellow-400 mb-4">라운드 결과</h3>

        {roundResult.winners.map((w, i) => (
          <div key={i} className="mb-3">
            <p className="text-base font-bold text-foreground">
              {getNickname(w.playerId)}
            </p>
            <p className="text-sm text-primary font-semibold">{w.handName}</p>
            <p className="text-yellow-400 font-bold">+{w.amount} 칩</p>
          </div>
        ))}

        {/* Showdown cards */}
        {roundResult.showdownCards && (
          <div className="flex flex-wrap gap-4 justify-center mt-3 mb-3">
            {Object.entries(roundResult.showdownCards).map(([playerId, cards]) => (
              <div key={playerId} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{getNickname(playerId)}</span>
                <div className="flex gap-0.5">
                  {(cards as Card[]).map((card, ci) => (
                    <CardDisplay key={ci} card={card} size="sm" animate="flip" animationDelay={ci * 0.15} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {roundResult.eliminatedPlayerIds.length > 0 && (
          <div className="text-xs text-red-400 mt-2">
            탈락: {roundResult.eliminatedPlayerIds.map((id) => getNickname(id)).join(", ")}
          </div>
        )}

        {countdown > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            다음 라운드까지 <span className="text-primary font-bold">{countdown}</span>초
          </div>
        )}
      </div>
    </div>
  );
}
