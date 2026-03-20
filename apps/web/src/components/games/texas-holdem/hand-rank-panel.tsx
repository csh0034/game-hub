"use client";

import { useMemo } from "react";
import type { Card } from "@game-hub/shared-types";
import { evaluateBestHand, HAND_RANK_INFO } from "@/lib/hand-evaluator";
import { CardDisplay } from "./card-display";

export function HandRankPanel({
  holeCards,
  communityCards,
}: {
  holeCards: Card[];
  communityCards: Card[];
}) {
  const allCards = useMemo(() => [...holeCards, ...communityCards], [holeCards, communityCards]);
  const currentHand = useMemo(() => evaluateBestHand(allCards), [allCards]);

  return (
    <div className="w-52 bg-card border border-border rounded-xl p-4 flex flex-col gap-3 self-start">
      <h3 className="text-sm font-bold text-foreground border-b border-border pb-2">
        My Hand
      </h3>

      <div className="flex gap-1.5 justify-center">
        {holeCards.map((card, i) => (
          <CardDisplay key={i} card={card} size="sm" />
        ))}
      </div>

      {currentHand && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">현재 핸드</p>
          <p className="text-sm font-bold text-primary">{currentHand.nameKr}</p>
          <p className="text-[10px] text-muted-foreground">{currentHand.name}</p>
        </div>
      )}

      <div className="flex flex-col gap-0.5 mt-1">
        <p className="text-[10px] text-muted-foreground mb-1 font-medium">HAND RANKINGS</p>
        {[...HAND_RANK_INFO].reverse().map((info) => {
          const isCurrentRank = currentHand?.rank === info.rank;
          return (
            <div
              key={info.rank}
              className={`flex items-center justify-between px-2 py-0.5 rounded text-[11px] transition-colors ${
                isCurrentRank
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-muted-foreground"
              }`}
            >
              <span>{info.nameKr}</span>
              <div className="flex gap-px">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-2.5 rounded-sm ${
                      i <= info.rank
                        ? isCurrentRank
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                        : "bg-muted/50"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
