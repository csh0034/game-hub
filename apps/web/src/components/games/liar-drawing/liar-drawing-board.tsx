"use client";

import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import type { LiarDrawingPublicState, LiarDrawingPrivateState } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { RoleReveal } from "./role-reveal";
import { DrawingPhase } from "./drawing-phase";
import { VotingPanel } from "./voting-panel";
import { LiarGuessPanel } from "./liar-guess-panel";
import { RoundResult } from "./round-result";
import { Scoreboard } from "./scoreboard";

export default function LiarDrawingBoard({ roomId }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, privateState, makeMove } = useGame(socket);

  const state = gameState as LiarDrawingPublicState | null;
  const liarPrivateState = privateState as LiarDrawingPrivateState | null;
  const myId = socket?.id || "";

  if (!state || !socket) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">로딩 중...</div>;
  }

  const renderPhase = () => {
    switch (state.phase) {
      case "role-reveal":
        return (
          <RoleReveal
            key={state.roundNumber}
            privateState={liarPrivateState}
            category={state.category}
            roundNumber={state.roundNumber}
            totalRounds={state.totalRounds}
          />
        );
      case "drawing":
        return <DrawingPhase state={state} socket={socket} myId={myId} keyword={liarPrivateState?.keyword ?? null} />;
      case "voting":
        return (
          <VotingPanel
            state={state}
            myId={myId}
            onVote={(targetPlayerId) => makeMove({ type: "vote", targetPlayerId })}
          />
        );
      case "liar-guess":
        return (
          <LiarGuessPanel
            state={state}
            myId={myId}
            onGuess={(guess) => makeMove({ type: "liar-guess", guess })}
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
      <div className="flex-1">{renderPhase()}</div>
      <Scoreboard state={state} myId={myId} />
    </div>
  );
}

function FinalResult({ state, myId }: { state: LiarDrawingPublicState; myId: string }) {
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
