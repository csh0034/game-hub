"use client";

import { useState } from "react";
import type { HoldemPublicState, HoldemPlayerState, HoldemAction } from "@game-hub/shared-types";

export function ActionButtons({
  state,
  myPlayer,
  canCheck,
  callAmount,
  canRaise,
  onAction,
}: {
  state: HoldemPublicState;
  myPlayer: Omit<HoldemPlayerState, "holeCards">;
  canCheck: boolean;
  callAmount: number;
  canRaise: boolean;
  onAction: (action: HoldemAction, amount?: number) => void;
}) {
  const [raiseAmount, setRaiseAmount] = useState(0);
  const effectiveRaise = raiseAmount || state.minRaise;

  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-5 py-3">
      <button
        onClick={() => onAction("fold")}
        className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        폴드
      </button>

      {canCheck ? (
        <button
          onClick={() => onAction("check")}
          className="bg-secondary hover:bg-secondary/80 text-foreground border border-border px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          체크
        </button>
      ) : (
        <button
          onClick={() => onAction("call")}
          className="bg-blue-600/15 hover:bg-blue-600/25 text-blue-500 border border-blue-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          콜 ({callAmount})
        </button>
      )}

      {canRaise && (
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <input
            type="range"
            min={state.minRaise}
            max={myPlayer.chips + myPlayer.currentBet}
            value={effectiveRaise}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
            className="w-28 accent-primary"
          />
          <span className="text-xs text-muted-foreground font-mono w-12 text-right">
            {effectiveRaise}
          </span>
          <button
            onClick={() => onAction("raise", effectiveRaise)}
            className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            레이즈
          </button>
        </div>
      )}

      {myPlayer.chips > 0 && (
        <button
          onClick={() => onAction("all-in")}
          className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-md"
        >
          올인 ({myPlayer.chips})
        </button>
      )}
    </div>
  );
}
