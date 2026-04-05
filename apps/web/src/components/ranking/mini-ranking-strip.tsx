"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";
import { useRanking } from "@/hooks/use-ranking";
import type { GameSocket } from "@/lib/socket";
import type { RankingGameType, RankingDifficulty, RankingKey } from "@game-hub/shared-types";
import { GAME_CONFIGS } from "@game-hub/shared-types";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  expert: "고급",
};

const RANKING_GAME_ICONS: Record<RankingGameType, string> = {
  minesweeper: GAME_CONFIGS.minesweeper.icon,
  "tetris-classic": GAME_CONFIGS.tetris.icon,
  tetris: GAME_CONFIGS.tetris.icon,
};

const RANKING_GAMES: { type: RankingGameType; label: string; difficulties: RankingDifficulty[] }[] = [
  { type: "minesweeper", label: "지뢰찾기", difficulties: ["beginner", "intermediate", "expert"] },
  { type: "tetris-classic", label: "테트리스 클래식", difficulties: ["beginner", "intermediate", "expert"] },
  { type: "tetris", label: "테트리스 스피드", difficulties: ["beginner", "intermediate", "expert"] },
];

function formatScore(gameType: RankingGameType, score: number): string {
  if (gameType === "minesweeper" || gameType === "tetris") {
    return `${(score / 1000).toFixed(3)}초`;
  }
  return `${score.toLocaleString()}점`;
}

interface MiniRankingStripProps {
  socket: GameSocket | null;
}

export default function MiniRankingStrip({ socket }: MiniRankingStripProps) {
  const { rankings, fetchRankings } = useRanking(socket);

  useEffect(() => {
    for (const game of RANKING_GAMES) {
      for (const d of game.difficulties) {
        fetchRankings(`${game.type}:${d}` as RankingKey);
      }
    }
  }, [fetchRankings]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] tracking-wide flex items-center gap-2">
          <Trophy className="w-5 h-5 text-neon-yellow" />
          랭킹 1위
        </h2>
        <Link
          href="/ranking"
          className="text-xs text-muted-foreground hover:text-neon-cyan transition-colors flex items-center gap-0.5"
        >
          전체 랭킹 보기
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RANKING_GAMES.map((game) => (
          <div
            key={game.type}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl leading-none">{RANKING_GAME_ICONS[game.type]}</span>
              <span className="font-semibold font-[family-name:var(--font-display)] tracking-wide">{game.label}</span>
            </div>
            <div className="space-y-1.5">
              {game.difficulties.map((difficulty) => {
                const key: RankingKey = `${game.type}:${difficulty}`;
                const entry = rankings[key]?.[0];
                return (
                  <div
                    key={difficulty}
                    className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-sm"
                  >
                    <span className="text-xs text-muted-foreground w-8 shrink-0">{DIFFICULTY_LABELS[difficulty]}</span>
                    {entry ? (
                      <>
                        <span className="text-neon-yellow text-xs">🥇</span>
                        <span className="font-medium flex-1 whitespace-nowrap">{entry.nickname}</span>
                        <span className="font-mono text-xs text-neon-cyan whitespace-nowrap">{formatScore(game.type, entry.score)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground flex-1">기록 없음</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
