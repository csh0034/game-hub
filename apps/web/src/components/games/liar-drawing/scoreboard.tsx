"use client";

import type { LiarDrawingPublicState } from "@game-hub/shared-types";

interface ScoreboardProps {
  state: LiarDrawingPublicState;
  myId: string;
}

const RANK_ICONS = ["🥇", "🥈", "🥉"];

export function Scoreboard({ state, myId }: ScoreboardProps) {
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <div className="border border-border rounded-xl p-3 min-w-[170px] bg-card/50 neon-border">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-display font-medium text-muted-foreground tracking-widest uppercase">Scoreboard</span>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">R{state.roundNumber}/{state.totalRounds}</span>
      </div>

      {/* 플레이어 목록 */}
      <div className="space-y-1">
        {sortedPlayers.map((player, index) => {
          const isMe = player.id === myId;
          const isLiar = state.phase !== "role-reveal" && state.phase !== "drawing" && player.id === state.liarId;

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                isMe ? "bg-primary/8 border border-primary/15" : ""
              }`}
            >
              {/* 좌측: 순위 + 닉네임 + 태그 */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`shrink-0 w-5 text-center ${index < 3 ? "text-sm" : "text-[10px] font-mono text-muted-foreground"}`}>
                  {index < 3 ? RANK_ICONS[index] : `${index + 1}`}
                </span>
                <span className={`truncate ${isMe ? "text-primary font-medium" : ""}`}>
                  {player.nickname}
                </span>
                {isMe && <span className="text-[10px] text-primary/60 shrink-0">(나)</span>}
                {isLiar && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-display shrink-0">🎭</span>
                )}
              </div>

              {/* 우측: 점수 */}
              <span className={`font-mono font-bold tabular-nums text-xs shrink-0 ${isMe ? "text-primary" : "text-foreground/80"}`}>
                {player.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
