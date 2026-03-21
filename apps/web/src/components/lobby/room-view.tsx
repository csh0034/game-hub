"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import type { Room, ChatMessage } from "@game-hub/shared-types";
import { GAME_CONFIGS, MINESWEEPER_DIFFICULTY_CONFIGS, TETRIS_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import { ChatPanel } from "@/components/chat/chat-panel";
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
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function PlayerLeftOverlay({
  nickname,
  willEnd,
  onDismiss,
  onReset,
}: {
  nickname: string;
  willEnd: boolean;
  onDismiss: () => void;
  onReset: () => void;
}) {
  const [countdown, setCountdown] = useState(willEnd ? 5 : 3);

  useEffect(() => {
    if (countdown <= 0) {
      if (willEnd) {
        onReset();
      } else {
        onDismiss();
      }
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, willEnd, onDismiss, onReset]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-lg">
      <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3 max-w-sm mx-4">
        <p className="text-lg font-bold">{nickname} 님이 게임을 떠났습니다.</p>
        {willEnd ? (
          <p className="text-muted-foreground">
            {countdown}초 후 대기실로 이동합니다.
          </p>
        ) : (
          <p className="text-muted-foreground">
            {countdown}초 후 닫힙니다.
          </p>
        )}
      </div>
    </div>
  );
}

interface RoomViewProps {
  room: Room;
  socket: GameSocket | null;
  nickname: string;
  onLeave: () => void;
  onLeaveImmediate: () => void;
  onToggleReady: () => void;
  roomMessages: ChatMessage[];
  onSendRoomMessage: (message: string) => void;
}

export function RoomView({ room, socket, nickname, onLeave, onLeaveImmediate, onToggleReady, roomMessages, onSendRoomMessage }: RoomViewProps) {
  const { gameState, gameResult, playerLeftInfo, startGame, requestRematch, setPlayerLeftInfo } = useGame(socket);
  const [chatOpen, setChatOpen] = useState(true);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(roomMessages.length);
  const config = GAME_CONFIGS[room.gameType];
  const isHost = socket?.id === room.hostId;
  const isPlaying = room.status === "playing" || !!gameState;

  // 채팅 열린 상태에서 메시지 수 동기화
  if (chatOpen && lastSeenMessageCount !== roomMessages.length) {
    setLastSeenMessageCount(roomMessages.length);
  }

  const hasUnread = !chatOpen && roomMessages.length > lastSeenMessageCount;

  const handlePlayerLeftDismiss = useCallback(() => {
    setPlayerLeftInfo(null);
  }, [setPlayerLeftInfo]);

  const handlePlayerLeftReset = useCallback(() => {
    setPlayerLeftInfo(null);
    onLeaveImmediate();
  }, [setPlayerLeftInfo, onLeaveImmediate]);

  const handleChatToggle = useCallback(() => {
    setChatOpen((prev) => {
      if (!prev) setLastSeenMessageCount(roomMessages.length);
      return !prev;
    });
  }, [roomMessages.length]);

  if (isPlaying && gameState) {
    return (
      <div className="space-y-4 relative">
        {playerLeftInfo && (
          <PlayerLeftOverlay
            nickname={playerLeftInfo.nickname}
            willEnd={playerLeftInfo.willEnd}
            onDismiss={handlePlayerLeftDismiss}
            onReset={handlePlayerLeftReset}
          />
        )}
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
            <p className="text-lg font-bold">
              {gameResult.winnerId
                ? gameResult.winnerId === socket?.id
                  ? "승리 하였습니다."
                  : "패배 하였습니다."
                : gameResult.reason}
            </p>
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

        <div className="mt-4">
          <button
            onClick={handleChatToggle}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <MessageCircle className="w-4 h-4" />
            채팅
            {hasUnread && !chatOpen && (
              <span className="w-2 h-2 bg-red-500 rounded-full" />
            )}
            {chatOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {chatOpen && (
            <div className="h-[300px]">
              <ChatPanel
                messages={roomMessages}
                onSendMessage={onSendRoomMessage}
                placeholder="게임 채팅..."
                myNickname={nickname}
                showNewMessageButton
              />
            </div>
          )}
        </div>
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

      {room.gameOptions && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">게임 옵션</h2>
          <div className="space-y-2 text-sm">
            {room.gameType === "minesweeper" && room.gameOptions.minesweeperDifficulty && (() => {
              const diff = MINESWEEPER_DIFFICULTY_CONFIGS[room.gameOptions.minesweeperDifficulty!];
              return (
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                  <span className="text-muted-foreground">난이도</span>
                  <span className="font-medium">{diff.label} ({diff.rows}×{diff.cols} · 💣{diff.mineCount})</span>
                </div>
              );
            })()}
            {room.gameType === "tetris" && room.gameOptions.tetrisDifficulty && (() => {
              const diff = TETRIS_DIFFICULTY_CONFIGS[room.gameOptions.tetrisDifficulty!];
              return (
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                  <span className="text-muted-foreground">난이도</span>
                  <span className="font-medium">{diff.label} (Lv.{diff.startLevel} · {diff.initialInterval}ms)</span>
                </div>
              );
            })()}
            {room.gameType === "liar-drawing" && (
              <>
                {room.gameOptions.liarDrawingTime != null && (
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">그리기 시간</span>
                    <span className="font-medium">{room.gameOptions.liarDrawingTime}초</span>
                  </div>
                )}
                {room.gameOptions.liarDrawingRounds != null && (
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">라운드 수</span>
                    <span className="font-medium">{room.gameOptions.liarDrawingRounds}라운드</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {isHost ? (
          <button
            onClick={startGame}
            disabled={room.players.length < config.minPlayers || !room.players.filter((p) => p.id !== room.hostId).every((p) => p.isReady)}
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

      <div className="h-[300px]">
        <ChatPanel
          messages={roomMessages}
          onSendMessage={onSendRoomMessage}
          placeholder="방 채팅..."
          myNickname={nickname}
          showNewMessageButton
        />
      </div>
    </div>
  );
}
