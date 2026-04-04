"use client";

import type { Room } from "@game-hub/shared-types";
import { GAME_CONFIGS, MAX_SPECTATORS, MINESWEEPER_DIFFICULTY_CONFIGS, TETRIS_DIFFICULTY_CONFIGS, TYPING_DIFFICULTY_CONFIGS, NONOGRAM_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import { Users, Clock, Play, Eye, MessageCircle, MessageCircleOff } from "lucide-react";
import { getServerElapsed } from "@/lib/socket";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {rooms.map((room) => {
        const config = GAME_CONFIGS[room.gameType];
        const isFull = room.players.length >= room.maxPlayers;
        const isPlaying = room.status === "playing";
        const isFinished = room.status === "finished";
        const spectateEnabled = room.gameOptions?.spectateEnabled;
        const spectatorsFull = room.spectators.length >= MAX_SPECTATORS;
        const spectateInGameEnabled = room.gameOptions?.spectateInGameEnabled;
        const canSpectate = spectateEnabled && !spectatorsFull && (room.status === "waiting" || (room.status === "playing" && spectateInGameEnabled));

        return (
          <div
            key={room.id}
            className="group bg-card border border-border rounded-lg p-3 transition-all duration-200 hover:border-neon-cyan/30 hover:shadow-[0_0_12px_rgba(0,229,255,0.05)]"
          >
            {/* 헤더: 아이콘 + 방이름 + 상태 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg leading-none">{config.icon}</span>
              <span className="text-sm font-semibold truncate flex-1">{room.name}</span>
              {room.status === "waiting" && (
                <span className="text-[10px] bg-neon-green/15 text-neon-green px-1.5 py-0.5 rounded leading-none shrink-0">
                  대기 중
                </span>
              )}
              {isPlaying && (
                <span className="text-[10px] bg-neon-pink/15 text-neon-pink px-1.5 py-0.5 rounded leading-none shrink-0 flex items-center gap-0.5">
                  <Play className="w-2.5 h-2.5" /> 게임 중
                </span>
              )}
              {isFinished && (
                <span className="text-[10px] bg-neon-yellow/15 text-neon-yellow px-1.5 py-0.5 rounded leading-none shrink-0">
                  종료
                </span>
              )}
            </div>

            {/* 메타 정보 */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2 flex-wrap">
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {room.players.length}/{room.maxPlayers}
              </span>
              {spectateEnabled && (
                <span className="flex items-center gap-0.5">
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
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {formatTime(room.createdAt)}
              </span>
              {(() => {
                const summary = getOptionsSummary(room);
                return summary ? (
                  <span className="bg-secondary px-1.5 py-0.5 rounded leading-none">{summary}</span>
                ) : null;
              })()}
            </div>

            {/* 참가자 목록 */}
            <div className="text-[11px] text-muted-foreground truncate mb-2.5 flex items-center gap-0.5">
              <Users className="w-3 h-3 shrink-0" />
              {room.players.map((p) => p.nickname).join(", ")}
              {room.spectators.length > 0 && (
                <span className="text-muted-foreground/50">
                  {" · "}
                  <Eye className="w-2.5 h-2.5 inline -mt-0.5" />
                  {" "}{room.spectators.map((s) => s.nickname).join(", ")}
                </span>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onJoinRoom(room.id)}
                disabled={isFull || isPlaying || isFinished}
                className="flex-1 bg-neon-cyan/90 hover:bg-neon-cyan disabled:bg-muted disabled:text-muted-foreground text-background py-1.5 rounded text-xs font-bold transition-all disabled:cursor-not-allowed hover:shadow-[0_0_10px_rgba(0,229,255,0.3)] font-[family-name:var(--font-display)]"
              >
                {isFull ? "만원" : isPlaying ? "진행 중" : isFinished ? "종료" : "참가"}
              </button>
              {canSpectate && onSpectateRoom && (
                <button
                  onClick={() => onSpectateRoom(room.id)}
                  className="border border-border hover:border-neon-cyan/30 hover:bg-neon-cyan/5 text-foreground px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  관전
                </button>
              )}
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
    case "nonogram": {
      const diff = NONOGRAM_DIFFICULTY_CONFIGS[opts?.nonogramDifficulty ?? "beginner"];
      return `${diff.label} (${diff.rows}×${diff.cols})`;
    }
    case "billiards":
      return `${opts?.billiardsTargetScore ?? 10}점 · 턴 ${opts?.billiardsTurnTime ?? 30}초`;
    default:
      return null;
  }
}

function formatTime(timestamp: number): string {
  const diff = Math.floor(getServerElapsed(timestamp) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}
