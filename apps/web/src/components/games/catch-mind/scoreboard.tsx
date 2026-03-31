"use client";

import type { CatchMindPublicState } from "@game-hub/shared-types";

interface ScoreboardProps {
  state: CatchMindPublicState;
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
          const isDrawerPlayer = player.id === state.drawerId;
          const isGuessedCorrectly = state.phase === "drawing" && player.hasGuessedCorrectly;
          const guessRankIndex = state.guessOrder.indexOf(player.id);
          const guessLabels = ["1등", "2등", "3등"];

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                isMe
                  ? "bg-primary/8 border border-primary/15"
                  : isGuessedCorrectly
                    ? "bg-success/5"
                    : ""
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
                {isDrawerPlayer && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neon-purple/10 text-neon-purple font-display shrink-0">🎨</span>
                )}
              </div>

              {/* 우측: 정답 태그 + 점수 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isGuessedCorrectly && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-display font-medium">
                    {guessRankIndex >= 0 ? guessLabels[guessRankIndex] : "✓"}
                  </span>
                )}
                <span className={`font-mono font-bold tabular-nums text-xs ${isMe ? "text-primary" : "text-foreground/80"}`}>
                  {player.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
