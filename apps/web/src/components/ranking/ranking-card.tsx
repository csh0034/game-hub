"use client";

import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { useRanking } from "@/hooks/use-ranking";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { GameSocket } from "@/lib/socket";
import type { RankingGameType, RankingDifficulty, RankingKey } from "@game-hub/shared-types";

const RANK_ICONS = ["🥇", "🥈", "🥉"];

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  expert: "고급",
};

function formatScore(gameType: RankingGameType, score: number): string {
  if (gameType === "minesweeper") {
    return `${(score / 1000).toFixed(1)}초`;
  }
  return `${score.toLocaleString()}점`;
}


interface RankingCardProps {
  gameType: RankingGameType;
  difficulty: RankingDifficulty;
  myNickname: string;
  socket: GameSocket | null;
  isAdmin?: boolean;
}

export default function RankingCard({ gameType, difficulty, myNickname, socket, isAdmin }: RankingCardProps) {
  const { rankings, fetchRankings, deleteRanking } = useRanking(socket);
  const key: RankingKey = `${gameType}:${difficulty}`;
  const entries = rankings[key] ?? [];
  const [deleteTarget, setDeleteTarget] = useState<{ entryId: string; nickname: string } | null>(null);

  useEffect(() => {
    fetchRankings(key);
  }, [key, fetchRankings]);

  const myBest = entries.find((e) => e.nickname === myNickname);
  const myRank = myBest ? entries.indexOf(myBest) + 1 : null;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteRanking(key, deleteTarget.entryId);
    if (!result.success) {
      toast.error(result.error ?? "삭제 실패");
    }
    setDeleteTarget(null);
  };

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
                className={`flex flex-col rounded-lg px-3 py-1.5 text-sm ${
                  isMe ? "bg-primary/10 text-primary font-semibold" : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 text-center shrink-0">
                    {i < 3 ? RANK_ICONS[i] : `${i + 1}`}
                  </span>
                  <span className="truncate flex-1">{entry.nickname}</span>
                  {isAdmin && (
                    <button
                      onClick={() => setDeleteTarget({ entryId: entry.id, nickname: entry.nickname })}
                      className="shrink-0 p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
                      title="기록 삭제"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-8 text-xs">
                  <span className="font-mono font-semibold">{formatScore(gameType, entry.score)}</span>
                  <span className="text-muted-foreground">{formatDateTime(entry.date)}</span>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="랭킹 기록 삭제"
        message={`"${deleteTarget?.nickname}" 의 기록을 삭제하시겠습니까?`}
        confirmText="삭제"
        cancelText="취소"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
