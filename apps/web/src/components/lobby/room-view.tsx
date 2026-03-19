"use client";

import { Suspense } from "react";
import type { Room } from "@game-hub/shared-types";
import { GAME_CONFIGS } from "@game-hub/shared-types";
import { useGame } from "@/hooks/use-game";
import { GameRenderer } from "@/lib/game-registry";
import type { GameSocket } from "@/lib/socket";
import {
  ArrowLeft,
  Crown,
  CheckCircle2,
  Circle,
  Play,
  RotateCcw,
} from "lucide-react";

interface RoomViewProps {
  room: Room;
  socket: GameSocket | null;
  onLeave: () => void;
  onToggleReady: () => void;
}

export function RoomView({ room, socket, onLeave, onToggleReady }: RoomViewProps) {
  const { gameState, gameResult, startGame, requestRematch } = useGame(socket);
  const config = GAME_CONFIGS[room.gameType];
  const isHost = socket?.id === room.hostId;
  const isPlaying = room.status === "playing" || !!gameState;

  if (isPlaying && gameState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onLeave}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">{room.name}</h1>
            <span className="text-sm bg-secondary px-2 py-0.5 rounded text-muted-foreground">
              {config.name}
            </span>
          </div>
          {gameResult && (
            <button
              onClick={requestRematch}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              다시하기
            </button>
          )}
        </div>

        {gameResult && (
          <div className="bg-card border border-primary/30 rounded-lg p-4 text-center">
            <p className="text-lg font-bold">{gameResult.reason}</p>
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              로딩 중...
            </div>
          }
        >
          <GameRenderer gameType={room.gameType} roomId={room.id} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onLeave}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <p className="text-sm text-muted-foreground">
            {config.icon} {config.name} · 대기 중
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">
          플레이어 ({room.players.length}/{room.maxPlayers})
        </h2>
        <div className="space-y-3">
          {room.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {player.nickname.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium">{player.nickname}</span>
                {player.id === room.hostId && (
                  <Crown className="w-4 h-4 text-yellow-500" />
                )}
              </div>
              {player.isReady ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          ))}
          {Array.from({ length: room.maxPlayers - room.players.length }).map(
            (_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center bg-secondary/20 rounded-lg px-4 py-3 border border-dashed border-border"
              >
                <span className="text-sm text-muted-foreground">대기 중...</span>
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex gap-3">
        {isHost ? (
          <button
            onClick={startGame}
            disabled={room.players.length < config.minPlayers}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" />
            게임 시작
          </button>
        ) : (
          <button
            onClick={onToggleReady}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium transition-colors"
          >
            준비 완료
          </button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        방 코드: <span className="font-mono text-foreground">{room.id}</span>
      </p>
    </div>
  );
}
