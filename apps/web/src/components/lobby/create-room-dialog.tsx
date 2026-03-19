"use client";

import { useState } from "react";
import {
  GAME_CONFIGS,
  MINESWEEPER_DIFFICULTY_CONFIGS,
  type GameType,
  type CreateRoomPayload,
  type MinesweeperDifficulty,
} from "@game-hub/shared-types";
import type { Room } from "@game-hub/shared-types";
import { Plus, X } from "lucide-react";

interface CreateRoomDialogProps {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<Room>;
}

export function CreateRoomDialog({ onCreateRoom }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gameType, setGameType] = useState<GameType>("gomoku");
  const [minesweeperDifficulty, setMinesweeperDifficulty] = useState<MinesweeperDifficulty>("beginner");

  const handleCreate = async () => {
    const roomName = name.trim() || `${GAME_CONFIGS[gameType].name} 방`;
    const payload: CreateRoomPayload = { name: roomName, gameType };
    if (gameType === "minesweeper") {
      payload.gameOptions = { minesweeperDifficulty };
    }
    await onCreateRoom(payload);
    setOpen(false);
    setName("");
    setMinesweeperDifficulty("beginner");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        방 만들기
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setOpen(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">새 방 만들기</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">방 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="방 이름을 입력하세요"
                maxLength={30}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">게임 선택</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(GAME_CONFIGS).map((config) => (
                  <button
                    key={config.gameType}
                    onClick={() => setGameType(config.gameType)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                      gameType === config.gameType
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <span className="text-xl">{config.icon}</span>
                    <span className="font-medium">{config.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {gameType === "minesweeper" && (
              <div>
                <label className="block text-sm font-medium mb-1.5">난이도</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(MINESWEEPER_DIFFICULTY_CONFIGS) as [MinesweeperDifficulty, typeof MINESWEEPER_DIFFICULTY_CONFIGS[MinesweeperDifficulty]][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setMinesweeperDifficulty(key)}
                      className={`p-2 rounded-lg border text-sm text-center transition-colors ${
                        minesweeperDifficulty === key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-border/80"
                      }`}
                    >
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {config.rows}×{config.cols} · 💣{config.mineCount}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleCreate}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              방 만들기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
