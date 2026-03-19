"use client";

import type { Room } from "@game-hub/shared-types";
import { GAME_CONFIGS } from "@game-hub/shared-types";
import { Users, Clock, Play, Loader2 } from "lucide-react";

interface RoomListProps {
  rooms: Room[];
  onJoinRoom: (roomId: string) => Promise<Room>;
}

export function RoomList({ rooms, onJoinRoom }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">열린 방이 없습니다</p>
        <p className="text-sm mt-1">새 방을 만들어보세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rooms.map((room) => {
        const config = GAME_CONFIGS[room.gameType];
        const isFull = room.players.length >= room.maxPlayers;
        const isPlaying = room.status === "playing";

        return (
          <div
            key={room.id}
            className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:border-border/80 transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{config.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{room.name}</span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                    {config.name}
                  </span>
                  {isPlaying && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                      <Play className="w-3 h-3" /> 게임 중
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {room.players.length}/{room.maxPlayers}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(room.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onJoinRoom(room.id)}
              disabled={isFull || isPlaying}
              className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isFull ? "만원" : isPlaying ? "진행 중" : "참가"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}
