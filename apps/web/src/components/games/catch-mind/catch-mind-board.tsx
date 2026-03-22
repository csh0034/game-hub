"use client";

import { useCallback } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { useChatStore } from "@/stores/chat-store";
import type { CatchMindPublicState, CatchMindPrivateState } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { RoleReveal } from "./role-reveal";
import { DrawingPhase } from "./drawing-phase";
import { RoundResult } from "./round-result";
import { Scoreboard } from "./scoreboard";
import { CatchMindChat } from "./catch-mind-chat";

export default function CatchMindBoard({ roomId: _roomId }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, privateState } = useGame(socket);
  const roomMessages = useChatStore((s) => s.roomMessages);

  const state = gameState as CatchMindPublicState | null;
  const cmPrivateState = privateState as CatchMindPrivateState | null;
  const myId = socket?.id || "";

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
            keyword={isDrawer ? (cmPrivateState?.keyword ?? null) : null}
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
        {renderPhase()}
        {state.phase === "drawing" && (
          <div className="mt-4 h-[250px]">
            <CatchMindChat
              key={state.roundNumber}
              state={state}
              socket={socket}
              myId={myId}
              messages={roomMessages}
              onSendMessage={sendRoomMessage}
              myNickname={myNickname}
            />
          </div>
        )}
      </div>
      <Scoreboard state={state} myId={myId} />
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
