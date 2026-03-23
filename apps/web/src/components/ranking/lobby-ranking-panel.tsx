"use client";

import { useState } from "react";
import RankingCard, { DIFFICULTY_LABELS } from "./ranking-card";
import type { GameSocket } from "@/lib/socket";
import type { RankingGameType, RankingDifficulty } from "@game-hub/shared-types";

const GAMES: { type: RankingGameType; label: string; difficulties: RankingDifficulty[] }[] = [
  { type: "minesweeper", label: "지뢰찾기", difficulties: ["beginner", "intermediate", "expert"] },
  { type: "tetris", label: "테트리스", difficulties: ["beginner", "intermediate", "expert"] },
];

interface LobbyRankingPanelProps {
  myNickname: string;
  socket: GameSocket | null;
}

export default function LobbyRankingPanel({ myNickname, socket }: LobbyRankingPanelProps) {
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
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              i === gameIndex
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
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
            className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              i === difficultyIndex
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
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
        />
      </div>
    </div>
  );
}
