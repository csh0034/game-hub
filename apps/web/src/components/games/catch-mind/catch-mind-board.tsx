"use client";

import { useCallback, useState } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { useChatStore } from "@/stores/chat-store";
import { useLobbyStore } from "@/stores/lobby-store";
import { HelpCircle } from "lucide-react";
import type { CatchMindPublicState, CatchMindPrivateState } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { GameHelpDialog } from "@/components/common/game-help-dialog";
import { RoleReveal } from "./role-reveal";
import { DrawingPhase } from "./drawing-phase";
import { RoundResult } from "./round-result";
import { Scoreboard } from "./scoreboard";
import { CatchMindChat } from "./catch-mind-chat";

export default function CatchMindBoard({ roomId: _roomId, isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, privateState } = useGame(socket);
  const roomMessages = useChatStore((s) => s.roomMessages);
  const spectateChatEnabled = useLobbyStore((s) => s.currentRoom?.gameOptions?.spectateChatEnabled ?? true);

  const state = gameState as CatchMindPublicState | null;
  const cmPrivateState = privateState as CatchMindPrivateState | null;
  const myId = socket?.id || "";

  const [showHelp, setShowHelp] = useState(false);

  const sendRoomMessage = useCallback(
    (message: string) => {
      socket?.emit("chat:room-message", message);
    },
    [socket],
  );

  if (!state || !socket) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">로딩 중...</div>;
  }

  const isDrawer = state.drawerId === myId;
  const drawerPlayer = state.players.find((p) => p.id === state.drawerId);
  const myNickname = state.players.find((p) => p.id === myId)?.nickname;

  const renderPhase = () => {
    switch (state.phase) {
      case "role-reveal":
        return (
          <RoleReveal
            key={state.roundNumber}
            privateState={cmPrivateState}
            drawerNickname={drawerPlayer?.nickname || ""}
            isDrawer={isDrawer}
            isSpectating={isSpectating}
            roundNumber={state.roundNumber}
            totalRounds={state.totalRounds}
            keywordLength={state.keywordLength}
          />
        );
      case "drawing":
        return (
          <DrawingPhase
            state={state}
            socket={socket}
            myId={myId}
            keyword={isDrawer || isSpectating ? (cmPrivateState?.keyword ?? null) : null}
            isSpectating={isSpectating}
          />
        );
      case "round-result":
        return <RoundResult state={state} myId={myId} isSpectating={isSpectating} />;
      case "final-result":
        return <FinalResult state={state} myId={myId} />;
    }
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="flex items-center mb-2">
          <div className="ml-auto">
            <button
              onClick={() => setShowHelp(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="게임 도움말"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
        {renderPhase()}
        <div className="mt-4 h-[250px]">
          <CatchMindChat
            state={state}
            myId={myId}
            messages={roomMessages}
            onSendMessage={sendRoomMessage}
            myNickname={myNickname}
            isSpectating={isSpectating}
            spectateChatEnabled={spectateChatEnabled}
          />
        </div>
      </div>
      <Scoreboard state={state} myId={myId} />

      <GameHelpDialog open={showHelp} onClose={() => setShowHelp(false)} title="캐치마인드">
        <div>
          <h3 className="text-foreground font-semibold mb-1">게임 방법</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>출제자가 제시어를 그림으로 표현한다 (글자/숫자 금지)</li>
            <li>나머지 플레이어는 채팅으로 정답을 맞춘다</li>
            <li>모든 플레이어가 한 번씩 출제자가 된다</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">점수 체계</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>1등: +3점, 2등: +2점, 3등: +1점</li>
            <li>3등이 나오면 즉시 라운드 종료</li>
            <li>출제자: 누군가 맞추면 +1점, 아무도 못 맞추면 0점</li>
          </ul>
        </div>
      </GameHelpDialog>
    </div>
  );
}

function FinalResult({ state, myId }: { state: CatchMindPublicState; myId: string }) {
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
  const topScore = sortedPlayers[0]?.score ?? 0;
  const winners = sortedPlayers.filter((p) => p.score === topScore);
  const isDraw = winners.length > 1;
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col items-center gap-6 py-8 phase-fade-up">
      {/* 타이틀 */}
      <div className="text-xs font-display text-muted-foreground tracking-widest uppercase">Final Result</div>

      {/* 우승자 */}
      <div className="phase-scale-in text-center">
        <div className="text-5xl mb-3">{isDraw ? "🤝" : "🏆"}</div>
        {isDraw ? (
          <div className="text-xl font-display font-bold text-neon-yellow">무승부!</div>
        ) : (
          <div>
            <div className="text-2xl font-display font-bold text-primary text-glow-cyan">{winners[0].nickname}</div>
            <div className="text-sm text-muted-foreground mt-1">우승!</div>
          </div>
        )}
      </div>

      {/* 순위 */}
      <div className="w-full max-w-xs border border-border rounded-xl p-4 bg-card/50 neon-border space-y-2">
        {sortedPlayers.map((player, index) => {
          const isMe = player.id === myId;
          const isFirst = index === 0;
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${
                isFirst
                  ? "bg-primary/10 border border-primary/20"
                  : isMe
                    ? "bg-primary/5 border border-primary/10"
                    : "bg-card/30"
              }`}
              style={{ animation: `phase-slide-rank 0.3s ${index * 0.1}s cubic-bezier(0.16, 1, 0.3, 1) both` }}
            >
              <span className="flex items-center gap-2">
                <span className={index < 3 ? "text-lg" : "text-muted-foreground text-xs w-[28px] text-center font-mono"}>{index < 3 ? medals[index] : `${index + 1}`}</span>
                <span className={`font-medium ${isMe ? "text-primary" : ""}`}>
                  {player.nickname}
                  {isMe && " (나)"}
                </span>
              </span>
              <span className={`font-mono font-bold ${isFirst ? "text-primary" : ""}`}>{player.score}점</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
