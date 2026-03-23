"use client";

import { useEffect } from "react";
import { Trophy } from "lucide-react";
import { useRanking } from "@/hooks/use-ranking";
import type { GameSocket } from "@/lib/socket";
import type { RankingGameType, RankingDifficulty, RankingKey } from "@game-hub/shared-types";

const RANK_ICONS = ["🥇", "🥈", "🥉"];

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  expert: "고급",
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

function formatScore(gameType: RankingGameType, score: number): string {
  if (gameType === "minesweeper") {
    return `${(score / 1000).toFixed(1)}초`;
  }
  return `${score.toLocaleString()}점`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

interface RankingCardProps {
  gameType: RankingGameType;
  difficulty: RankingDifficulty;
  myNickname: string;
  socket: GameSocket | null;
}

export default function RankingCard({ gameType, difficulty, myNickname, socket }: RankingCardProps) {
  const { rankings, fetchRankings } = useRanking(socket);
  const key: RankingKey = `${gameType}:${difficulty}`;
  const entries = rankings[key] ?? [];

  useEffect(() => {
    fetchRankings(key);
  }, [key, fetchRankings]);

  const myBest = entries.find((e) => e.nickname === myNickname);
  const myRank = myBest ? entries.indexOf(myBest) + 1 : null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" />
        랭킹 ({DIFFICULTY_LABELS[difficulty] ?? difficulty})
      </h2>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          아직 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => {
            const isMe = entry.nickname === myNickname;
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                  isMe ? "bg-primary/10 text-primary font-semibold" : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 text-center shrink-0">
                    {i < 3 ? RANK_ICONS[i] : `${i + 1}`}
                  </span>
                  <span className="truncate">{entry.nickname}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="font-mono">{formatScore(gameType, entry.score)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                </div>
              </div>
            );
          })}

          {myBest && myRank && (
            <div className="border-t border-border mt-2 pt-2 text-sm text-muted-foreground text-center">
              내 최고: {formatScore(gameType, myBest.score)} (#{myRank})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
