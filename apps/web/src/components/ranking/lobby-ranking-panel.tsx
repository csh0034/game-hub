"use client";

import { useState } from "react";
import RankingCard, { DIFFICULTY_LABELS } from "./ranking-card";
import type { GameSocket } from "@/lib/socket";
import type { RankingGameType, RankingDifficulty } from "@game-hub/shared-types";

const GAMES: { type: RankingGameType; label: string; difficulties: RankingDifficulty[] }[] = [
  { type: "minesweeper", label: "지뢰찾기", difficulties: ["beginner", "intermediate", "expert"] },
  { type: "tetris", label: "테트리스 스피드", difficulties: ["beginner", "intermediate", "expert"] },
];

interface LobbyRankingPanelProps {
  myNickname: string;
  socket: GameSocket | null;
  isAdmin?: boolean;
}

export default function LobbyRankingPanel({ myNickname, socket, isAdmin }: LobbyRankingPanelProps) {
  const [gameIndex, setGameIndex] = useState(0);
  const [difficultyIndex, setDifficultyIndex] = useState(0);

  const game = GAMES[gameIndex];

  const handleGameChange = (index: number) => {
    setGameIndex(index);
    setDifficultyIndex(0);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {GAMES.map((g, i) => (
          <button
            key={g.type}
            onClick={() => handleGameChange(i)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              i === gameIndex
                ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_8px_rgba(0,229,255,0.1)]"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary border border-transparent"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        {game.difficulties.map((d, i) => (
          <button
            key={d}
            onClick={() => setDifficultyIndex(i)}
            className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
              i === difficultyIndex
                ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary border border-transparent"
            }`}
          >
            {DIFFICULTY_LABELS[d] ?? d}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto">
        <RankingCard
          gameType={game.type}
          difficulty={game.difficulties[difficultyIndex]}
          myNickname={myNickname}
          socket={socket}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
