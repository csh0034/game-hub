"use client";

import { useCallback, useState } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { useChatStore } from "@/stores/chat-store";
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
        return <RoundResult state={state} />;
      case "final-result":
        return <FinalResult state={state} myId={myId} />;
    }
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowHelp(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="게임 도움말"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
        {renderPhase()}
        <div className="mt-4 h-[250px]">
          <CatchMindChat
            state={state}
            myId={myId}
            messages={roomMessages}
            onSendMessage={sendRoomMessage}
            myNickname={myNickname}
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

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-2xl font-bold">최종 결과</div>

      {isDraw ? (
        <div className="text-lg text-muted-foreground">동점 무승부!</div>
      ) : (
        <div className="text-lg">
          <span className="text-primary font-bold">{winners[0].nickname}</span>님이 우승!
        </div>
      )}

      <div className="border border-border rounded-lg p-4 min-w-[250px]">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`flex justify-between items-center py-2 ${
              index < sortedPlayers.length - 1 ? "border-b border-border" : ""
            } ${player.id === myId ? "text-primary" : ""}`}
          >
            <span className="font-medium">
              {index + 1}위 {player.nickname}
              {player.id === myId && " (나)"}
            </span>
            <span className="font-mono font-bold">{player.score}점</span>
          </div>
        ))}
      </div>
    </div>
  );
}
