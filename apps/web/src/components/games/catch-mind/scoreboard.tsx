"use client";

import type { CatchMindPublicState } from "@game-hub/shared-types";

interface ScoreboardProps {
  state: CatchMindPublicState;
  myId: string;
}

export function Scoreboard({ state, myId }: ScoreboardProps) {
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <div className="border border-border rounded-lg p-3 min-w-[160px]">
      <div className="text-xs font-medium mb-2 text-muted-foreground">
        점수판 (R{state.roundNumber}/{state.totalRounds})
      </div>
      <div className="space-y-1">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`flex justify-between items-center text-sm ${player.id === myId ? "text-primary font-medium" : ""}`}
          >
            <span className="truncate">
              {index + 1}. {player.nickname}
              {player.id === myId && " (나)"}
              {player.id === state.drawerId && " [출제자]"}
            </span>
            <div className="flex items-center gap-1 ml-2">
              {state.phase === "drawing" && player.hasGuessedCorrectly && (() => {
                const rankIndex = state.guessOrder.indexOf(player.id);
                const rankLabels = ["1등", "2등", "3등"];
                return <span className="text-green-500 text-xs">{rankIndex >= 0 ? rankLabels[rankIndex] : "✓"}</span>;
              })()}
              <span className="font-mono">{player.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
