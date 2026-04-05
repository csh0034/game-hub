"use client";

import { useState } from "react";
import RankingCard from "./ranking-card";
import type { GameSocket } from "@/lib/socket";
import type { RankingGameType, RankingDifficulty } from "@game-hub/shared-types";
import { GAME_CONFIGS } from "@game-hub/shared-types";

const RANKING_GAME_LABELS: Record<RankingGameType, string> = {
  minesweeper: "지뢰찾기",
  tetris: "테트리스 스피드",
};

const RANKING_GAMES: { type: RankingGameType; difficulties: RankingDifficulty[] }[] = [
  { type: "minesweeper", difficulties: ["beginner", "intermediate", "expert"] },
  { type: "tetris", difficulties: ["beginner", "intermediate", "expert"] },
];

interface RankingDashboardProps {
  myNickname: string;
  socket: GameSocket | null;
  isAdmin?: boolean;
}

export default function RankingDashboard({ myNickname, socket, isAdmin }: RankingDashboardProps) {
  const [gameIndex, setGameIndex] = useState(0);

  const game = RANKING_GAMES[gameIndex];

  const handleGameChange = (index: number) => {
    setGameIndex(index);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {RANKING_GAMES.map((g, i) => (
          <button
            key={g.type}
            onClick={() => handleGameChange(i)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              i === gameIndex
                ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_8px_rgba(0,229,255,0.1)]"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary border border-transparent"
            }`}
          >
            <span className="text-lg leading-none">{GAME_CONFIGS[g.type].icon}</span>
            {RANKING_GAME_LABELS[g.type]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {game.difficulties.map((difficulty) => (
          <RankingCard
            key={difficulty}
            gameType={game.type}
            difficulty={difficulty}
            myNickname={myNickname}
            socket={socket}
            isAdmin={isAdmin}
            compact
          />
        ))}
      </div>
    </div>
  );
}
