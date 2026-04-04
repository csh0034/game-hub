"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import type { Room, ChatMessage, GameOptions, MinesweeperDifficulty, TetrisDifficulty, TypingDifficulty, NonogramDifficulty } from "@game-hub/shared-types";
import { GAME_CONFIGS, MAX_SPECTATORS, MAX_ROOM_NAME_LENGTH, MINESWEEPER_DIFFICULTY_CONFIGS, TETRIS_DIFFICULTY_CONFIGS, TYPING_DIFFICULTY_CONFIGS, NONOGRAM_DIFFICULTY_CONFIGS } from "@game-hub/shared-types";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useGame } from "@/hooks/use-game";
import { GameRenderer, FULLSCREEN_GAME_TYPES } from "@/lib/game-registry";
import type { GameSocket } from "@/lib/socket";
import { toast } from "sonner";
import {
  ArrowLeft,
  Crown,
  CheckCircle2,
  Circle,
  Play,
  RotateCcw,
  MessageCircle,
  Link,
  Eye,
  Users,
  X,
  Pencil,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import RankingCard from "@/components/ranking/ranking-card";
import type { RankingGameType, RankingDifficulty } from "@game-hub/shared-types";

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
            {countdown}초 후 로비로 이동합니다.
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
  isSpectating?: boolean;
  onLeave: () => void;
  onLeaveImmediate: () => void;
  onToggleReady: () => void;
  onUpdateGameOptions: (gameOptions: GameOptions) => void;
  onUpdateRoomName?: (name: string) => Promise<void>;
  onKickSpectators?: () => Promise<void>;
  onKickPlayer?: (targetId: string) => Promise<void>;
  onSwitchRole?: () => Promise<void>;
  roomMessages: ChatMessage[];
  onSendRoomMessage: (message: string) => void;
  onlinePlayers?: { nickname: string }[];
  onWhisper?: (targetNickname: string, message: string) => void;
}

export function RoomView({ room, socket, nickname, isSpectating, onLeave, onLeaveImmediate, onToggleReady, onUpdateGameOptions, onUpdateRoomName, onKickSpectators, onKickPlayer, onSwitchRole, roomMessages, onSendRoomMessage, onlinePlayers, onWhisper }: RoomViewProps) {
  const { gameState, playerLeftInfo, startGame, requestRematch, setPlayerLeftInfo } = useGame(socket);
  const [pendingOptions, setPendingOptions] = useState<GameOptions | null>(null);
  const [kickConfirmOpen, setKickConfirmOpen] = useState(false);
  const [rematchConfirmOpen, setRematchConfirmOpen] = useState(false);
  const [pendingKickOptions, setPendingKickOptions] = useState<GameOptions | null>(null);
  const [kickTarget, setKickTarget] = useState<{ id: string; nickname: string } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const config = GAME_CONFIGS[room.gameType];
  const isHost = socket?.id === room.hostId;

  const handleSubmitName = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed.length === 0 || trimmed === room.name) {
      setIsEditingName(false);
      return;
    }
    onUpdateRoomName?.(trimmed).catch(() => {});
    setIsEditingName(false);
  }, [editName, room.name, onUpdateRoomName]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingName(false);
  }, []);
  const myPlayer = room.players.find((p) => p.id === socket?.id);
  const isPlaying = room.status === "playing" || !!gameState;
  const spectateChatEnabled = room.gameOptions?.spectateChatEnabled ?? true;

  // 방장: 로컬 pending 값 우선, 아니면 서버 값 사용
  const localOptions = (isHost && pendingOptions) ? pendingOptions : (room.gameOptions ?? {});

  const handleOptionChange = useCallback((newOptions: GameOptions) => {
    // 관전 ON → OFF 전환 시 관전자가 있으면 확인 다이얼로그
    const prevEnabled = (pendingOptions ?? room.gameOptions ?? {}).spectateEnabled;
    if (prevEnabled && !newOptions.spectateEnabled && room.spectators.length > 0) {
      setPendingKickOptions(newOptions);
      setKickConfirmOpen(true);
      return;
    }
    // 관전 OFF로 전환 시 관전자 채팅도 OFF, ON 전환 시 기본값 ON
    if (!newOptions.spectateEnabled) {
      newOptions = { ...newOptions, spectateChatEnabled: false, spectateInGameEnabled: false };
    } else if (newOptions.spectateEnabled && !prevEnabled) {
      newOptions = { ...newOptions, spectateChatEnabled: true, spectateInGameEnabled: true };
    }
    setPendingOptions(newOptions);
    onUpdateGameOptions(newOptions);
  }, [onUpdateGameOptions, pendingOptions, room.gameOptions, room.spectators.length]);


  const handlePlayerLeftDismiss = useCallback(() => {
    setPlayerLeftInfo(null);
  }, [setPlayerLeftInfo]);

  const handlePlayerLeftReset = useCallback(() => {
    setPlayerLeftInfo(null);
    onLeaveImmediate();
  }, [setPlayerLeftInfo, onLeaveImmediate]);


  if (isPlaying && gameState) {
    const isFullscreen = FULLSCREEN_GAME_TYPES.includes(room.gameType);

    if (isFullscreen) {
      return (
        <div className="fixed inset-0 top-[var(--navbar-height,56px)] z-40 bg-gray-950">
          {playerLeftInfo && (
            <PlayerLeftOverlay
              nickname={playerLeftInfo.nickname}
              willEnd={playerLeftInfo.willEnd}
              onDismiss={handlePlayerLeftDismiss}
              onReset={handlePlayerLeftReset}
            />
          )}
          {/* Minimal header overlay */}
          <div className="pointer-events-auto absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2">
            <button
              onClick={onLeave}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {isSpectating && (
              <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded flex items-center gap-1">
                <Eye className="w-3 h-3" /> 관전 중
              </span>
            )}
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-muted-foreground">
                로딩 중...
              </div>
            }
          >
            <GameRenderer gameType={room.gameType} roomId={room.id} isSpectating={isSpectating} />
          </Suspense>
        </div>
      );
    }

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
            {isSpectating && (
              <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded flex items-center gap-1">
                <Eye className="w-3 h-3" /> 관전 중
              </span>
            )}
          </div>
          {isHost && room.status !== "waiting" && (
            <button
              onClick={() => room.status === "finished" ? requestRematch() : setRematchConfirmOpen(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              다시하기
            </button>
          )}
        </div>

        {isSpectating && (room.gameType === "liar-drawing" || room.gameType === "catch-mind" || room.gameType === "nonogram") && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-600">
            관전자 모드: 모든 정보가 공개됩니다
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              로딩 중...
            </div>
          }
        >
          <GameRenderer gameType={room.gameType} roomId={room.id} isSpectating={isSpectating} />
        </Suspense>

        {room.gameType !== "catch-mind" && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MessageCircle className="w-4 h-4" />
              채팅
            </div>
            <div className="h-[300px]">
              <ChatPanel
                messages={roomMessages}
                onSendMessage={onSendRoomMessage}
                placeholder={isSpectating && !spectateChatEnabled ? "관전자 채팅이 허용되지 않습니다" : "게임 채팅... (@닉네임으로 귓속말)"}
                myNickname={nickname}
                mySocketId={socket?.id}
                disabled={isSpectating && !spectateChatEnabled}
                onlinePlayers={onlinePlayers}
                onWhisper={onWhisper}
              />
            </div>
          </div>
        )}

        <ConfirmDialog
          open={rematchConfirmOpen}
          title="다시하기"
          message="진행 중인 게임을 종료하고 대기실로 돌아갑니다."
          confirmText="다시하기"
          cancelText="취소"
          onConfirm={() => {
            setRematchConfirmOpen(false);
            requestRematch();
          }}
          onCancel={() => setRematchConfirmOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="lg:grid lg:gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onLeave}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {isHost && !isSpectating ? (
            isEditingName ? (
              <input
                ref={editInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitName();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                onBlur={handleSubmitName}
                maxLength={MAX_ROOM_NAME_LENGTH}
                autoFocus
                className="text-2xl font-bold bg-transparent border-b-2 border-primary outline-none w-full"
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer hover:text-primary/80 group flex items-center gap-1 truncate"
                onClick={() => { setIsEditingName(true); setEditName(room.name); }}
              >
                <span className="truncate">{room.name}</span>
                <Pencil className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
              </h1>
            )
          ) : (
            <h1 className="text-2xl font-bold truncate">{room.name}</h1>
          )}
          <p className="text-sm text-muted-foreground">
            {config.icon} {config.name} · 대기 중
          </p>
        </div>
        <button
          onClick={() => {
            const url = window.location.origin + "/room/" + room.id;
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(url).then(() => {
                toast.success("링크가 복사되었습니다");
              });
            } else {
              // HTTP 환경 fallback
              const textarea = document.createElement("textarea");
              textarea.value = url;
              textarea.style.position = "fixed";
              textarea.style.opacity = "0";
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              document.body.removeChild(textarea);
              toast.success("링크가 복사되었습니다");
            }
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <Link className="w-3.5 h-3.5" />
          링크 복사
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
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
              <div className="flex items-center gap-2">
                {player.isReady ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
                {isHost && player.id !== room.hostId && !isPlaying && (
                  <button
                    onClick={() => setKickTarget({ id: player.id, nickname: player.nickname })}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                    title="내보내기"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {Array.from({ length: room.maxPlayers - room.players.length }).map(
            (_, i) => {
              const canSwitch = isSpectating && !isPlaying && room.gameOptions?.spectateEnabled && onSwitchRole;
              return canSwitch ? (
                <button
                  key={`empty-${i}`}
                  onClick={() => onSwitchRole()}
                  className="flex items-center bg-secondary/20 rounded-lg px-4 py-3 border border-dashed border-border hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors w-full text-left"
                >
                  <span className="text-sm text-primary">클릭하여 플레이어로 이동</span>
                </button>
              ) : (
                <div
                  key={`empty-${i}`}
                  className="flex items-center bg-secondary/20 rounded-lg px-4 py-3 border border-dashed border-border"
                >
                  <span className="text-sm text-muted-foreground">대기 중...</span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {room.gameOptions?.spectateEnabled && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-500" />
            관전자 ({room.spectators.length}/{MAX_SPECTATORS})
          </h2>
          <div className="space-y-3">
            {room.spectators.map((spectator) => (
              <div
                key={spectator.id}
                className="flex items-center justify-between bg-amber-500/5 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    {spectator.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{spectator.nickname}</span>
                  <span className="text-xs bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded">관전</span>
                </div>
                {isHost && !isPlaying && (
                  <button
                    onClick={() => setKickTarget({ id: spectator.id, nickname: spectator.nickname })}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                    title="내보내기"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: MAX_SPECTATORS - room.spectators.length }).map(
              (_, i) => {
                const canSwitch = !isSpectating && !isHost && !isPlaying && room.gameOptions?.spectateEnabled && onSwitchRole;
                return canSwitch ? (
                  <button
                    key={`empty-spectator-${i}`}
                    onClick={() => onSwitchRole()}
                    className="flex items-center bg-secondary/20 rounded-lg px-4 py-3 border border-dashed border-border hover:border-amber-500 hover:bg-amber-500/5 cursor-pointer transition-colors w-full text-left"
                  >
                    <span className="text-sm text-amber-600">클릭하여 관전자로 이동</span>
                  </button>
                ) : (
                  <div
                    key={`empty-spectator-${i}`}
                    className="flex items-center bg-secondary/20 rounded-lg px-4 py-3 border border-dashed border-border"
                  >
                    <span className="text-sm text-muted-foreground">관전 대기...</span>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">게임 옵션</h2>
          {isHost && !isPlaying ? (
            <div className="space-y-3 text-sm">
              {room.gameType === "gomoku" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">턴 제한시간</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={10}
                        max={60}
                        value={localOptions.gomokuTurnTime ?? 30}
                        onChange={(e) => handleOptionChange({ ...localOptions, gomokuTurnTime: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5">{localOptions.gomokuTurnTime ?? 30}초</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">흑돌 (선공)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([["host", "방장"], ["guest", "상대"]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => handleOptionChange({ ...localOptions, gomokuFirstColor: key })}
                          className={`p-2 rounded-lg border text-sm text-center transition-colors ${
                            (localOptions.gomokuFirstColor ?? "host") === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="font-medium">{label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">게임 규칙</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([["free", "자유룰"], ["renju", "렌주룰"]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => handleOptionChange({ ...localOptions, gomokuRuleType: key })}
                          className={`p-2 rounded-lg border text-sm text-center transition-colors ${
                            (localOptions.gomokuRuleType ?? "free") === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {key === "free" ? "금수 없음" : "흑 금수 적용"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {room.gameType === "minesweeper" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">난이도</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(MINESWEEPER_DIFFICULTY_CONFIGS) as [MinesweeperDifficulty, typeof MINESWEEPER_DIFFICULTY_CONFIGS[MinesweeperDifficulty]][]).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleOptionChange({ ...localOptions, minesweeperDifficulty: key })}
                        className={`p-2 rounded-lg border text-sm text-center transition-colors ${
                          (localOptions.minesweeperDifficulty ?? "beginner") === key
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
              {room.gameType === "nonogram" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">난이도</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(Object.entries(NONOGRAM_DIFFICULTY_CONFIGS) as [NonogramDifficulty, typeof NONOGRAM_DIFFICULTY_CONFIGS[NonogramDifficulty]][]).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleOptionChange({ ...localOptions, nonogramDifficulty: key })}
                        className={`p-1.5 rounded-lg border text-sm text-center transition-colors ${
                          (localOptions.nonogramDifficulty ?? "beginner") === key
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-border/80"
                        }`}
                      >
                        <div className="font-medium text-xs">{config.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {config.rows}×{config.cols}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {room.gameType === "tetris" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">게임 모드</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: "classic" as const, label: "클래식", desc: "점수를 올리며 생존" },
                        { key: "speed-race" as const, label: "스피드 레이스", desc: "40줄 클리어! 시간 도전" },
                      ]).map(({ key, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => handleOptionChange({ ...localOptions, tetrisMode: key })}
                          className={`p-2 rounded-lg border text-sm text-center transition-colors ${
                            (localOptions.tetrisMode ?? "classic") === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">난이도</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(TETRIS_DIFFICULTY_CONFIGS) as [TetrisDifficulty, typeof TETRIS_DIFFICULTY_CONFIGS[TetrisDifficulty]][]).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() => handleOptionChange({ ...localOptions, tetrisDifficulty: key })}
                          className={`p-2 rounded-lg border text-sm text-center transition-colors ${
                            (localOptions.tetrisDifficulty ?? "beginner") === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="font-medium">{config.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Lv.{config.startLevel} · {config.initialInterval}ms
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {room.gameType === "liar-drawing" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">그리기 시간</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={120}
                        value={localOptions.liarDrawingTime ?? 60}
                        onChange={(e) => handleOptionChange({ ...localOptions, liarDrawingTime: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5">{localOptions.liarDrawingTime ?? 60}초</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">라운드 수</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={localOptions.liarDrawingRounds ?? 3}
                        onChange={(e) => handleOptionChange({ ...localOptions, liarDrawingRounds: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5 whitespace-nowrap">{localOptions.liarDrawingRounds ?? 3}라운드</span>
                    </div>
                  </div>
                </div>
              )}
              {room.gameType === "catch-mind" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">그리기 시간</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={120}
                        value={localOptions.catchMindTime ?? 60}
                        onChange={(e) => handleOptionChange({ ...localOptions, catchMindTime: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5">{localOptions.catchMindTime ?? 60}초</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">라운드 수</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={localOptions.catchMindRounds ?? 3}
                        onChange={(e) => handleOptionChange({ ...localOptions, catchMindRounds: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5 whitespace-nowrap">{localOptions.catchMindRounds ?? 3}라운드</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">글자 수 힌트</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOptionChange({ ...localOptions, catchMindCharHint: true })}
                        className={`py-2 rounded-lg text-sm font-medium border transition-colors ${localOptions.catchMindCharHint ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                      >
                        ON
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOptionChange({ ...localOptions, catchMindCharHint: false })}
                        className={`py-2 rounded-lg text-sm font-medium border transition-colors ${!localOptions.catchMindCharHint ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                      >
                        OFF
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {room.gameType === "typing" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">난이도</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(TYPING_DIFFICULTY_CONFIGS) as [TypingDifficulty, typeof TYPING_DIFFICULTY_CONFIGS[TypingDifficulty]][]).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() => handleOptionChange({ ...localOptions, typingDifficulty: key })}
                          className={`p-2 rounded-lg border text-sm text-center transition-colors ${
                            (localOptions.typingDifficulty ?? "beginner") === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="font-medium">{config.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {config.minChars}~{config.maxChars}자
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">제한 시간</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={10}
                        max={120}
                        value={localOptions.typingTimeLimit ?? 60}
                        onChange={(e) => handleOptionChange({ ...localOptions, typingTimeLimit: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5">{localOptions.typingTimeLimit ?? 60}초</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">목숨</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={localOptions.typingLives ?? 3}
                        onChange={(e) => handleOptionChange({ ...localOptions, typingLives: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5">❤️×{localOptions.typingLives ?? 3}</span>
                    </div>
                  </div>
                </div>
              )}
              {room.gameType === "billiards" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">목표 점수</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={3}
                        max={20}
                        value={localOptions.billiardsTargetScore ?? 10}
                        onChange={(e) => handleOptionChange({ ...localOptions, billiardsTargetScore: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5">{localOptions.billiardsTargetScore ?? 10}점</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">턴 제한시간</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={10}
                        max={60}
                        value={localOptions.billiardsTurnTime ?? 30}
                        onChange={(e) => handleOptionChange({ ...localOptions, billiardsTurnTime: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold tabular-nums min-w-14 text-center text-primary bg-primary/10 rounded-md px-2 py-0.5">{localOptions.billiardsTurnTime ?? 30}초</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="border-t border-border pt-3 mt-3">
                <label className="block text-sm font-medium mb-1.5">관전 허용</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOptionChange({ ...localOptions, spectateEnabled: true })}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${localOptions.spectateEnabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                  >
                    ON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOptionChange({ ...localOptions, spectateEnabled: false })}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${!localOptions.spectateEnabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                  >
                    OFF
                  </button>
                </div>
              </div>
              {localOptions.spectateEnabled && (
                <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">관전자 채팅</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOptionChange({ ...localOptions, spectateChatEnabled: true })}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${localOptions.spectateChatEnabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOptionChange({ ...localOptions, spectateChatEnabled: false })}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${!localOptions.spectateChatEnabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">게임 중 관전</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOptionChange({ ...localOptions, spectateInGameEnabled: true })}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${localOptions.spectateInGameEnabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOptionChange({ ...localOptions, spectateInGameEnabled: false })}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${!localOptions.spectateInGameEnabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {room.gameType === "gomoku" && (
                <>
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">턴 제한시간</span>
                    <span className="font-medium">{room.gameOptions?.gomokuTurnTime ?? 30}초</span>
                  </div>
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">흑돌 (선공)</span>
                    <span className="font-medium">{(room.gameOptions?.gomokuFirstColor ?? "host") === "host" ? "방장" : "상대"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">게임 규칙</span>
                    <span className="font-medium">{(room.gameOptions?.gomokuRuleType ?? "free") === "free" ? "자유룰" : "렌주룰"}</span>
                  </div>
                </>
              )}
              {room.gameType === "minesweeper" && room.gameOptions?.minesweeperDifficulty && (() => {
                const diff = MINESWEEPER_DIFFICULTY_CONFIGS[room.gameOptions.minesweeperDifficulty];
                return (
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">난이도</span>
                    <span className="font-medium">{diff.label} ({diff.rows}×{diff.cols} · 💣{diff.mineCount})</span>
                  </div>
                );
              })()}
              {room.gameType === "nonogram" && (() => {
                const diff = NONOGRAM_DIFFICULTY_CONFIGS[room.gameOptions?.nonogramDifficulty ?? "beginner"];
                return (
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">난이도</span>
                    <span className="font-medium">{diff.label} ({diff.rows}×{diff.cols})</span>
                  </div>
                );
              })()}
              {room.gameType === "tetris" && (() => {
                const diff = TETRIS_DIFFICULTY_CONFIGS[room.gameOptions?.tetrisDifficulty ?? "beginner"];
                const mode = room.gameOptions?.tetrisMode ?? "classic";
                return (
                  <>
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">모드</span>
                      <span className="font-medium">{mode === "speed-race" ? "스피드 레이스" : "클래식"}</span>
                    </div>
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">난이도</span>
                      <span className="font-medium">{diff.label} (Lv.{diff.startLevel} · {diff.initialInterval}ms)</span>
                    </div>
                  </>
                );
              })()}
              {room.gameType === "liar-drawing" && (
                <>
                  {room.gameOptions?.liarDrawingTime != null && (
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">그리기 시간</span>
                      <span className="font-medium">{room.gameOptions.liarDrawingTime}초</span>
                    </div>
                  )}
                  {room.gameOptions?.liarDrawingRounds != null && (
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">라운드 수</span>
                      <span className="font-medium">{room.gameOptions.liarDrawingRounds}라운드</span>
                    </div>
                  )}
                </>
              )}
              {room.gameType === "catch-mind" && (
                <>
                  {room.gameOptions?.catchMindTime != null && (
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">그리기 시간</span>
                      <span className="font-medium">{room.gameOptions.catchMindTime}초</span>
                    </div>
                  )}
                  {room.gameOptions?.catchMindRounds != null && (
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">라운드 수</span>
                      <span className="font-medium">{room.gameOptions.catchMindRounds}라운드</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">글자 수 힌트</span>
                    <span className="font-medium">{room.gameOptions?.catchMindCharHint ? "ON" : "OFF"}</span>
                  </div>
                </>
              )}
              {room.gameType === "typing" && (() => {
                const diff = TYPING_DIFFICULTY_CONFIGS[room.gameOptions?.typingDifficulty ?? "beginner"];
                return (
                  <>
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">난이도</span>
                      <span className="font-medium">{diff.label} ({diff.minChars}~{diff.maxChars}자)</span>
                    </div>
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">제한 시간</span>
                      <span className="font-medium">{room.gameOptions?.typingTimeLimit ?? 60}초</span>
                    </div>
                    <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                      <span className="text-muted-foreground">목숨</span>
                      <span className="font-medium">❤️×{room.gameOptions?.typingLives ?? 3}</span>
                    </div>
                  </>
                );
              })()}
              <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                <span className="text-muted-foreground">관전 허용</span>
                <span className="font-medium">{room.gameOptions?.spectateEnabled ? "ON" : "OFF"}</span>
              </div>
              {room.gameOptions?.spectateEnabled && (
                <>
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">관전자 채팅</span>
                    <span className="font-medium">{room.gameOptions?.spectateChatEnabled ? "ON" : "OFF"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2">
                    <span className="text-muted-foreground">게임 중 관전</span>
                    <span className="font-medium">{room.gameOptions?.spectateInGameEnabled ? "ON" : "OFF"}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      <div className="sticky bottom-0 z-10 bg-background pt-4 pb-2">
        <div className="flex gap-3">
          {isSpectating ? (
            <div className="flex-1 flex items-center justify-center gap-2 bg-amber-500/10 text-amber-600 py-3 rounded-lg font-medium">
              <Eye className="w-5 h-5" />
              관전 대기 중
            </div>
          ) : isHost ? (
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
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                myPlayer?.isReady
                  ? "bg-success hover:bg-success/90 text-white"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
            >
              {myPlayer?.isReady && <CheckCircle2 className="w-5 h-5" />}
              {myPlayer?.isReady ? "준비 취소" : "준비 완료"}
            </button>
          )}
        </div>
      </div>

      </div>

      <aside className="mt-6 lg:mt-0 flex flex-col gap-4">
        <div className="h-[400px]">
          <ChatPanel
            messages={roomMessages}
            onSendMessage={onSendRoomMessage}
            placeholder={isSpectating && !spectateChatEnabled ? "관전자 채팅이 허용되지 않습니다" : "방 채팅... (@닉네임으로 귓속말)"}
            myNickname={nickname}
            mySocketId={socket?.id}
            disabled={isSpectating && !spectateChatEnabled}
            onlinePlayers={onlinePlayers}
            onWhisper={onWhisper}
          />
        </div>
        {(room.gameType === "minesweeper" || (room.gameType === "tetris" && room.players.length <= 1 && room.gameOptions?.tetrisMode === "speed-race")) && (
          <RankingCard
            gameType={room.gameType as RankingGameType}
            difficulty={
              (room.gameType === "minesweeper"
                ? room.gameOptions?.minesweeperDifficulty ?? "beginner"
                : room.gameOptions?.tetrisDifficulty ?? "beginner") as RankingDifficulty
            }
            myNickname={nickname}
            socket={socket}
          />
        )}
      </aside>
      </div>

      <ConfirmDialog
        open={kickConfirmOpen}
        title="관전자 내보내기"
        message="관전자를 모두 내보내시겠습니까?"
        confirmText="내보내기"
        cancelText="취소"
        onConfirm={async () => {
          setKickConfirmOpen(false);
          if (onKickSpectators) {
            await onKickSpectators();
          }
          if (pendingKickOptions) {
            const opts = { ...pendingKickOptions, spectateChatEnabled: false, spectateInGameEnabled: false };
            setPendingOptions(opts);
            onUpdateGameOptions(opts);
            setPendingKickOptions(null);
          }
        }}
        onCancel={() => {
          setKickConfirmOpen(false);
          setPendingKickOptions(null);
        }}
      />

      <ConfirmDialog
        open={!!kickTarget}
        title="내보내기"
        message={`${kickTarget?.nickname ?? ""} 님을 내보내시겠습니까?`}
        confirmText="내보내기"
        cancelText="취소"
        onConfirm={async () => {
          if (kickTarget && onKickPlayer) {
            await onKickPlayer(kickTarget.id);
          }
          setKickTarget(null);
        }}
        onCancel={() => setKickTarget(null)}
      />

    </div>
  );
}
