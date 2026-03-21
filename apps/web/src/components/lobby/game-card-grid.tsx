"use client";

import {
  GAME_CONFIGS,
  COMING_SOON_GAMES,
  MINESWEEPER_DIFFICULTY_CONFIGS,
  type GameType,
  type CreateRoomPayload,
  type MinesweeperDifficulty,
} from "@game-hub/shared-types";
import type { Room } from "@game-hub/shared-types";
import { Users, Zap } from "lucide-react";

interface GameCardGridProps {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<Room>;
}

function getQuickStartBadges(gameType: GameType): string[] | null {
  switch (gameType) {
    case "tetris":
      return ["Normal"];
    case "liar-drawing":
      return ["60초", "3라운드"];
    default:
      return null;
  }
}

export function GameCardGrid({ onCreateRoom }: GameCardGridProps) {
  const games = Object.values(GAME_CONFIGS);

  const handleQuickCreate = async (gameType: GameType) => {
    const config = GAME_CONFIGS[gameType];
    if (config.disabled) return;
    const payload: CreateRoomPayload = { name: `${config.name} 방`, gameType };
    if (gameType === "tetris") {
      payload.gameOptions = { tetrisDifficulty: "normal" };
    }
    if (gameType === "liar-drawing") {
      payload.gameOptions = { liarDrawingTime: 60, liarDrawingRounds: 3 };
    }
    await onCreateRoom(payload);
  };

  const handleMinesweeperCreate = async (difficulty: MinesweeperDifficulty) => {
    await onCreateRoom({
      name: "지뢰찾기 방",
      gameType: "minesweeper",
      gameOptions: { minesweeperDifficulty: difficulty },
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map((game) => (
        <div key={game.gameType}>
          {game.gameType === "minesweeper" ? (
            <div className="group relative w-full h-full bg-card border border-border rounded-xl p-6 text-left transition-all duration-300">
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">{game.icon}</span>
                </div>
                <h3 className="text-lg font-semibold mb-3">{game.name}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(MINESWEEPER_DIFFICULTY_CONFIGS) as [MinesweeperDifficulty, typeof MINESWEEPER_DIFFICULTY_CONFIGS[MinesweeperDifficulty]][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => handleMinesweeperCreate(key)}
                      className="p-2 rounded-lg border border-border bg-background text-sm text-center hover:border-primary/50 hover:bg-primary/10 transition-colors"
                    >
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {config.rows}×{config.cols}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleQuickCreate(game.gameType)}
              disabled={game.disabled}
              className={`group relative w-full h-full bg-card border border-border rounded-xl p-6 text-left transition-all duration-300 ${game.disabled ? "opacity-60 cursor-default" : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">{game.icon}</span>
                  {game.disabled && (
                    <span className="text-xs font-semibold bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">
                      {game.disabledReason ?? "점검중"}
                    </span>
                  )}
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
                {!game.disabled && (() => {
                  const badges = getQuickStartBadges(game.gameType);
                  if (!badges) return null;
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-primary/70 mt-2 flex-wrap">
                      <Zap className="w-3 h-3 shrink-0" />
                      {badges.map((badge) => (
                        <span key={badge} className="bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
                          {badge}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </button>
          )}
        </div>
      ))}
      {COMING_SOON_GAMES.map((game) => (
        <div key={game.name}>
          <button
            disabled
            className="group relative w-full h-full bg-card border border-border rounded-xl p-6 text-left transition-all duration-300 opacity-60 cursor-default"
          >
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
          </button>
        </div>
      ))}
    </div>
  );
}
