"use client";

import {
  GAME_CONFIGS,
  COMING_SOON_GAMES,
  MINESWEEPER_DIFFICULTY_CONFIGS,
  NONOGRAM_DIFFICULTY_CONFIGS,
  type GameType,
  type CreateRoomPayload,
  type MinesweeperDifficulty,
  type NonogramDifficulty,
} from "@game-hub/shared-types";
import type { Room } from "@game-hub/shared-types";
import { Users, Zap } from "lucide-react";

interface GameCardGridProps {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<Room>;
}

const NEW_GAMES: GameType[] = ["nonogram", "typing"];

function getQuickStartBadges(gameType: GameType): string[] | null {
  switch (gameType) {
    case "gomoku":
      return ["30초", "방장 선공", "자유룰"];
    case "tetris":
      return ["클래식", "초급"];
    case "liar-drawing":
      return ["60초", "3라운드"];
    case "catch-mind":
      return ["60초", "3라운드", "글자 수 힌트 OFF"];
    case "typing":
      return ["초급", "60초", "❤️×3"];
    case "nonogram":
      return null;
    default:
      return null;
  }
}

function CardBadge({ type, text }: { type: "new" | "disabled" | "coming"; text: string }) {
  const styles = {
    new: "bg-neon-green/20 text-neon-green animate-pulse",
    disabled: "bg-neon-yellow/15 text-neon-yellow",
    coming: "bg-neon-purple/15 text-neon-purple",
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles[type]}`}>
      {text}
    </span>
  );
}

function CardHeader({ icon, badge }: { icon: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-4xl">{icon}</span>
      {badge}
    </div>
  );
}

function CardBody({ name, description, min, max }: { name: string; description: string; min: number; max: number }) {
  return (
    <>
      <h3 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-1">{name}</h3>
      <p className="text-sm text-foreground/60 mb-2 line-clamp-2 min-h-10">{description}</p>
      <div className="flex items-center gap-1 text-xs text-foreground/50 mb-3">
        <Users className="w-3 h-3" />
        <span>{min === max ? `${min}명` : `${min}-${max}명`}</span>
      </div>
    </>
  );
}

export function GameCardGrid({ onCreateRoom }: GameCardGridProps) {
  const games = Object.values(GAME_CONFIGS);

  const handleQuickCreate = async (gameType: GameType) => {
    const config = GAME_CONFIGS[gameType];
    if (config.disabled) return;
    const payload: CreateRoomPayload = { name: `${config.name} 방`, gameType };
    if (gameType === "tetris") {
      payload.gameOptions = { tetrisDifficulty: "beginner" };
    }
    if (gameType === "liar-drawing") {
      payload.gameOptions = { liarDrawingTime: 60, liarDrawingRounds: 3 };
    }
    if (gameType === "catch-mind") {
      payload.gameOptions = { catchMindTime: 60, catchMindRounds: 3, catchMindCharHint: false };
    }
    if (gameType === "gomoku") {
      payload.gameOptions = { gomokuTurnTime: 30 };
    }
    if (gameType === "typing") {
      payload.gameOptions = { typingDifficulty: "beginner", typingTimeLimit: 60, typingLives: 3 };
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

  const handleNonogramCreate = async (difficulty: NonogramDifficulty) => {
    await onCreateRoom({
      name: "노노그램 방",
      gameType: "nonogram",
      gameOptions: { nonogramDifficulty: difficulty },
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map((game) => (
        <div key={game.gameType}>
          {game.gameType === "nonogram" ? (
            <div className="group relative w-full h-full flex flex-col bg-card border border-border rounded-xl p-6 text-left transition-all duration-300 neon-border-hover">
              <div className="relative flex flex-col flex-1">
                <CardHeader icon={game.icon} badge={<CardBadge type="new" text="NEW" />} />
                <CardBody name={game.name} description={game.description} min={game.minPlayers} max={game.maxPlayers} />
                <div className="mt-auto pt-3">
                  <div className="grid grid-cols-5 gap-1.5">
                    {(Object.entries(NONOGRAM_DIFFICULTY_CONFIGS) as [NonogramDifficulty, typeof NONOGRAM_DIFFICULTY_CONFIGS[NonogramDifficulty]][]).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleNonogramCreate(key)}
                        className="p-1.5 rounded-lg border border-border bg-background text-sm text-center hover:border-neon-cyan/50 hover:bg-neon-cyan/5 hover:shadow-[0_0_10px_rgba(0,229,255,0.1)] transition-all"
                      >
                        <div className="font-medium text-xs">{config.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {config.rows}×{config.cols}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : game.gameType === "minesweeper" ? (
            <div className="group relative w-full h-full flex flex-col bg-card border border-border rounded-xl p-6 text-left transition-all duration-300 neon-border-hover">
              <div className="relative flex flex-col flex-1">
                <CardHeader icon={game.icon} />
                <CardBody name={game.name} description={game.description} min={game.minPlayers} max={game.maxPlayers} />
                <div className="mt-auto pt-3">
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(MINESWEEPER_DIFFICULTY_CONFIGS) as [MinesweeperDifficulty, typeof MINESWEEPER_DIFFICULTY_CONFIGS[MinesweeperDifficulty]][]).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleMinesweeperCreate(key)}
                        className="p-2 rounded-lg border border-border bg-background text-sm text-center hover:border-neon-cyan/50 hover:bg-neon-cyan/5 hover:shadow-[0_0_10px_rgba(0,229,255,0.1)] transition-all"
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
            </div>
          ) : (
            <button
              onClick={() => handleQuickCreate(game.gameType)}
              disabled={game.disabled}
              className={`group relative w-full h-full flex flex-col bg-card border border-border rounded-xl p-6 text-left transition-all duration-300 ${game.disabled ? "opacity-50 cursor-default" : "neon-border-hover hover:shadow-[0_0_20px_rgba(0,229,255,0.08)]"}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col flex-1">
                <CardHeader
                  icon={game.icon}
                  badge={
                    game.disabled
                      ? <CardBadge type="disabled" text={game.disabledReason ?? "점검중"} />
                      : NEW_GAMES.includes(game.gameType)
                        ? <CardBadge type="new" text="NEW" />
                        : undefined
                  }
                />
                <CardBody name={game.name} description={game.description} min={game.minPlayers} max={game.maxPlayers} />
                <div className="mt-auto">
                  {!game.disabled && (() => {
                    const badges = getQuickStartBadges(game.gameType);
                    if (!badges) return null;
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-neon-cyan/70 mt-2 flex-wrap">
                        <Zap className="w-3 h-3 shrink-0" />
                        {badges.map((badge) => (
                          <span key={badge} className="bg-neon-cyan/10 text-neon-cyan/80 px-1.5 py-0.5 rounded font-medium">
                            {badge}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </button>
          )}
        </div>
      ))}
      {COMING_SOON_GAMES.map((game) => (
        <div key={game.name}>
          <button
            disabled
            className="group relative w-full h-full flex flex-col bg-card border border-border rounded-xl p-6 text-left transition-all duration-300 opacity-40 cursor-default"
          >
            <div className="relative flex flex-col flex-1">
              <CardHeader icon={game.icon} badge={<CardBadge type="coming" text="오픈 예정" />} />
              <CardBody name={game.name} description={game.description} min={game.minPlayers} max={game.maxPlayers} />
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
