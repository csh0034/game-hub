"use client";

import { useState } from "react";
import {
  GAME_CONFIGS,
  COMING_SOON_GAMES,
  MINESWEEPER_DIFFICULTY_CONFIGS,
  type GameType,
  type CreateRoomPayload,
  type MinesweeperDifficulty,
} from "@game-hub/shared-types";
import type { Room } from "@game-hub/shared-types";
import { Users } from "lucide-react";

interface GameCardGridProps {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<Room>;
}

export function GameCardGrid({ onCreateRoom }: GameCardGridProps) {
  const games = Object.values(GAME_CONFIGS);
  const [expandedGame, setExpandedGame] = useState<GameType | null>(null);

  const handleQuickCreate = async (gameType: GameType) => {
    if (gameType === "minesweeper") {
      setExpandedGame((prev) => (prev === "minesweeper" ? null : "minesweeper"));
      return;
    }
    const config = GAME_CONFIGS[gameType];
    await onCreateRoom({ name: `${config.name} 방`, gameType });
  };

  const handleMinesweeperCreate = async (difficulty: MinesweeperDifficulty) => {
    await onCreateRoom({
      name: "지뢰찾기 방",
      gameType: "minesweeper",
      gameOptions: { minesweeperDifficulty: difficulty },
    });
    setExpandedGame(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map((game) => (
        <div key={game.gameType}>
          <button
            onClick={() => handleQuickCreate(game.gameType)}
            className="group relative w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="text-4xl mb-3">{game.icon}</div>
              <h3 className="text-lg font-semibold mb-1">{game.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{game.description}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers}명`
                    : `${game.minPlayers}-${game.maxPlayers}명`}
                </span>
              </div>
            </div>
          </button>
          {game.gameType === "minesweeper" && expandedGame === "minesweeper" && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(Object.entries(MINESWEEPER_DIFFICULTY_CONFIGS) as [MinesweeperDifficulty, typeof MINESWEEPER_DIFFICULTY_CONFIGS[MinesweeperDifficulty]][]).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleMinesweeperCreate(key)}
                  className="p-2 rounded-lg border border-border bg-card text-sm text-center hover:border-primary/50 hover:bg-primary/10 transition-colors"
                >
                  <div className="font-medium">{config.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {config.rows}×{config.cols} · 💣{config.mineCount}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {COMING_SOON_GAMES.map((game) => (
        <div key={game.name}>
          <div className="group relative w-full bg-card border border-border rounded-xl p-6 text-left opacity-60 cursor-default">
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-4xl">{game.icon}</span>
                <span className="text-xs font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  오픈 예정
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-1">{game.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{game.description}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers}명`
                    : `${game.minPlayers}-${game.maxPlayers}명`}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
