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
import { Zap } from "lucide-react";

interface GameCardGridProps {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<Room>;
}

const NEW_GAMES: GameType[] = ["nonogram"];
const BETA_GAMES: GameType[] = ["billiards"];

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
    case "billiards":
      return ["10점", "30초"];
    default:
      return null;
  }
}

function StatusBadge({ type, text }: { type: "new" | "beta" | "disabled" | "coming"; text: string }) {
  const styles = {
    new: "bg-neon-green/20 text-neon-green animate-pulse",
    beta: "bg-neon-yellow/15 text-neon-yellow",
    disabled: "bg-neon-yellow/15 text-neon-yellow",
    coming: "bg-neon-purple/15 text-neon-purple",
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${styles[type]}`}>
      {text}
    </span>
  );
}

function QuickBadges({ gameType }: { gameType: GameType }) {
  const badges = getQuickStartBadges(gameType);
  if (!badges) return null;
  return (
    <div className="flex items-center gap-1 text-[11px] text-neon-cyan/50 mt-1.5 leading-none">
      <Zap className="w-2.5 h-2.5 shrink-0 text-neon-cyan/30" />
      <span className="truncate tracking-tight">{badges.join(" · ")}</span>
    </div>
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
    if (gameType === "billiards") {
      payload.gameOptions = { billiardsTargetScore: 10, billiardsTurnTime: 30 };
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
      {games.map((game) => (
        <div key={game.gameType}>
          {game.gameType === "nonogram" ? (
            <div className="group relative h-full flex flex-col bg-card border border-border rounded-lg p-4 text-left transition-all duration-200 neon-border-hover">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl leading-none">{game.icon}</span>
                <span className="text-base font-semibold font-[family-name:var(--font-display)] truncate">{game.name}</span>
                <StatusBadge type="new" text="NEW" />
              </div>
              <div className="grid grid-cols-5 gap-1 mt-auto">
                {(Object.entries(NONOGRAM_DIFFICULTY_CONFIGS) as [NonogramDifficulty, typeof NONOGRAM_DIFFICULTY_CONFIGS[NonogramDifficulty]][]).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleNonogramCreate(key)}
                    className="py-1 rounded border border-border bg-background text-center hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all"
                  >
                    <div className="font-medium text-[10px] leading-none">{config.label}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5 leading-none">
                      {config.rows}×{config.cols}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : game.gameType === "minesweeper" ? (
            <div className="group relative h-full flex flex-col bg-card border border-border rounded-lg p-4 text-left transition-all duration-200 neon-border-hover">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl leading-none">{game.icon}</span>
                <span className="text-base font-semibold font-[family-name:var(--font-display)] truncate">{game.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-auto">
                {(Object.entries(MINESWEEPER_DIFFICULTY_CONFIGS) as [MinesweeperDifficulty, typeof MINESWEEPER_DIFFICULTY_CONFIGS[MinesweeperDifficulty]][]).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleMinesweeperCreate(key)}
                    className="py-1.5 rounded border border-border bg-background text-center hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all"
                  >
                    <div className="font-medium text-[11px] leading-none">{config.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                      {config.rows}×{config.cols}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleQuickCreate(game.gameType)}
              disabled={game.disabled}
              className={`group relative w-full h-full flex flex-col bg-card border border-border rounded-lg p-4 text-left transition-all duration-200 ${game.disabled ? "opacity-50 cursor-default" : "neon-border-hover hover:shadow-[0_0_15px_rgba(0,229,255,0.06)]"}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{game.icon}</span>
                  <span className="text-sm font-semibold font-[family-name:var(--font-display)] truncate">{game.name}</span>
                  {game.disabled
                    ? <StatusBadge type="disabled" text={game.disabledReason ?? "점검중"} />
                    : NEW_GAMES.includes(game.gameType)
                      ? <StatusBadge type="new" text="NEW" />
                      : BETA_GAMES.includes(game.gameType)
                        ? <StatusBadge type="beta" text="BETA" />
                        : null}
                </div>
                <p className="text-xs text-foreground/40 mt-1.5 line-clamp-1 leading-tight">{game.description}</p>
                {!game.disabled && <QuickBadges gameType={game.gameType} />}
              </div>
            </button>
          )}
        </div>
      ))}
      {COMING_SOON_GAMES.map((game) => (
        <div key={game.name}>
          <button
            disabled
            className="group relative w-full h-full flex flex-col bg-card border border-border rounded-lg p-4 text-left transition-all duration-200 opacity-40 cursor-default"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">{game.icon}</span>
              <span className="text-sm font-semibold font-[family-name:var(--font-display)] truncate">{game.name}</span>
              <StatusBadge type="coming" text="오픈 예정" />
            </div>
            <p className="text-xs text-foreground/40 mt-1.5 line-clamp-1 leading-tight">{game.description}</p>
          </button>
        </div>
      ))}
    </div>
  );
}
