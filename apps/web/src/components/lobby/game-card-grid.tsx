"use client";

import { GAME_CONFIGS, type GameType, type CreateRoomPayload } from "@game-hub/shared-types";
import type { Room } from "@game-hub/shared-types";
import { Users } from "lucide-react";

interface GameCardGridProps {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<Room>;
}

export function GameCardGrid({ onCreateRoom }: GameCardGridProps) {
  const games = Object.values(GAME_CONFIGS);

  const handleQuickCreate = async (gameType: GameType) => {
    const config = GAME_CONFIGS[gameType];
    await onCreateRoom({ name: `${config.name} 방`, gameType });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map((game) => (
        <button
          key={game.gameType}
          onClick={() => handleQuickCreate(game.gameType)}
          className="group relative bg-card border border-border rounded-xl p-6 text-left hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
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
      ))}
    </div>
  );
}
