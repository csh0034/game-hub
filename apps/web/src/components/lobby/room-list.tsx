"use client";

import type { Room } from "@game-hub/shared-types";
import { GAME_CONFIGS, MAX_SPECTATORS, MINESWEEPER_DIFFICULTY_CONFIGS, TETRIS_DIFFICULTY_CONFIGS, TYPING_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import { Users, Clock, Play, Eye, MessageCircle, MessageCircleOff } from "lucide-react";

interface RoomListProps {
  rooms: Room[];
  onJoinRoom: (roomId: string) => Promise<Room>;
  onSpectateRoom?: (roomId: string) => Promise<Room>;
}

export function RoomList({ rooms, onJoinRoom, onSpectateRoom }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-border rounded-xl">
        <p className="text-lg font-[family-name:var(--font-display)]">열린 방이 없습니다</p>
        <p className="text-sm mt-1">새 방을 만들어보세요!</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {rooms.map((room) => {
        const config = GAME_CONFIGS[room.gameType];
        const isFull = room.players.length >= room.maxPlayers;
        const isPlaying = room.status === "playing";
        const spectateEnabled = room.gameOptions?.spectateEnabled;
        const spectatorsFull = room.spectators.length >= MAX_SPECTATORS;
        const spectateInGameEnabled = room.gameOptions?.spectateInGameEnabled;
        const canSpectate = spectateEnabled && !spectatorsFull && (room.status === "waiting" || (room.status === "playing" && spectateInGameEnabled));

        return (
          <div
            key={room.id}
            className="flex items-center justify-between bg-card px-4 py-3 hover:bg-neon-cyan/[0.03] transition-colors border-t border-border first:border-t-0"
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
                    <span className="text-xs bg-neon-pink/15 text-neon-pink px-2 py-0.5 rounded flex items-center gap-1">
                      <Play className="w-3 h-3" /> 게임 중
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {room.players.length}/{room.maxPlayers}
                  </span>
                  {spectateEnabled && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {room.spectators.length}/{MAX_SPECTATORS}
                      {room.gameOptions?.spectateChatEnabled ? (
                        <MessageCircle className="w-3 h-3 text-neon-yellow" />
                      ) : (
                        <MessageCircleOff className="w-3 h-3 text-muted-foreground/50" />
                      )}
                      {spectateInGameEnabled && (
                        <Play className="w-3 h-3 text-neon-green" />
                      )}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(room.createdAt)}
                  </span>
                  {(() => {
                    const summary = getOptionsSummary(room);
                    return summary ? (
                      <span className="bg-secondary px-1.5 py-0.5 rounded">{summary}</span>
                    ) : null;
                  })()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground truncate max-w-64 flex items-center gap-1">
                  <Users className="w-3 h-3 shrink-0" />
                  {room.players.map((p) => p.nickname).join(", ")}
                </div>
                {room.spectators.length > 0 && (
                  <div className="mt-0.5 text-xs text-muted-foreground truncate max-w-64 flex items-center gap-1">
                    <Eye className="w-3 h-3 shrink-0" />
                    {room.spectators.map((s) => s.nickname).join(", ")}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canSpectate && onSpectateRoom && (
                <button
                  onClick={() => onSpectateRoom(room.id)}
                  className="border border-border hover:border-neon-cyan/30 hover:bg-neon-cyan/5 text-foreground px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  관전
                </button>
              )}
              <button
                onClick={() => onJoinRoom(room.id)}
                disabled={isFull || isPlaying}
                className="bg-neon-cyan/90 hover:bg-neon-cyan disabled:bg-muted disabled:text-muted-foreground text-background px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:cursor-not-allowed hover:shadow-[0_0_12px_rgba(0,229,255,0.3)] font-[family-name:var(--font-display)]"
              >
                {isFull ? "만원" : isPlaying ? "진행 중" : "참가"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getOptionsSummary(room: Room): string | null {
  const opts = room.gameOptions;
  switch (room.gameType) {
    case "gomoku":
      return `턴 ${opts?.gomokuTurnTime ?? 30}초 · ${(opts?.gomokuFirstColor ?? "host") === "host" ? "방장" : "상대"} 선공 · ${(opts?.gomokuRuleType ?? "free") === "free" ? "자유룰" : "렌주룰"}`;
    case "minesweeper": {
      if (!opts?.minesweeperDifficulty) return null;
      const diff = MINESWEEPER_DIFFICULTY_CONFIGS[opts.minesweeperDifficulty];
      return `${diff.label} (${diff.rows}×${diff.cols})`;
    }
    case "tetris": {
      if (!opts?.tetrisDifficulty) return null;
      const diff = TETRIS_DIFFICULTY_CONFIGS[opts.tetrisDifficulty];
      const mode = opts?.tetrisMode === "speed-race" ? "스피드 레이스" : "클래식";
      return `${mode} · ${diff.label} (Lv.${diff.startLevel})`;
    }
    case "liar-drawing": {
      const parts: string[] = [];
      if (opts?.liarDrawingTime != null) parts.push(`${opts.liarDrawingTime}초`);
      if (opts?.liarDrawingRounds != null) parts.push(`${opts.liarDrawingRounds}라운드`);
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "catch-mind": {
      const parts: string[] = [];
      if (opts?.catchMindTime != null) parts.push(`${opts.catchMindTime}초`);
      if (opts?.catchMindRounds != null) parts.push(`${opts.catchMindRounds}라운드`);
      if (opts?.catchMindCharHint != null) parts.push(`힌트${opts.catchMindCharHint ? "ON" : "OFF"}`);
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "typing": {
      const diff = TYPING_DIFFICULTY_CONFIGS[opts?.typingDifficulty ?? "beginner"];
      const parts: string[] = [diff.label];
      parts.push(`${opts?.typingTimeLimit ?? 60}초`);
      parts.push(`❤️×${opts?.typingLives ?? 3}`);
      return parts.join(" · ");
    }
    default:
      return null;
  }
}

function formatTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}
