"use client";

import { useState } from "react";
import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { HelpCircle } from "lucide-react";
import type { LiarDrawingPublicState, LiarDrawingPrivateState } from "@game-hub/shared-types";
import type { GameComponentProps } from "@/lib/game-registry";
import { GameHelpDialog } from "@/components/common/game-help-dialog";
import { RoleReveal } from "./role-reveal";
import { DrawingPhase } from "./drawing-phase";
import { VotingPanel } from "./voting-panel";
import { LiarGuessPanel } from "./liar-guess-panel";
import { RoundResult } from "./round-result";
import { Scoreboard } from "./scoreboard";

export default function LiarDrawingBoard({ isSpectating }: GameComponentProps) {
  const { socket } = useSocket();
  const { gameState, privateState, makeMove } = useGame(socket);
  const [showHelp, setShowHelp] = useState(false);

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
        return <DrawingPhase state={state} socket={socket} myId={myId} keyword={liarPrivateState?.keyword ?? null} isSpectating={isSpectating} />;
      case "voting":
        return (
          <VotingPanel
            state={state}
            myId={myId}
            onVote={(targetPlayerId) => makeMove({ type: "vote", targetPlayerId })}
            isSpectating={isSpectating}
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
      <div className="flex-1">
        <div className="flex items-center mb-2">
          {isSpectating && liarPrivateState && (
            <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
              <span className="text-muted-foreground">라이어: </span>
              <span className="font-bold text-yellow-400">{state.players.find((p) => p.id === liarPrivateState.liarId)?.nickname ?? "?"}</span>
            </div>
          )}
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
      </div>
      <Scoreboard state={state} myId={myId} />

      <GameHelpDialog open={showHelp} onClose={() => setShowHelp(false)} title="라이어 드로잉">
        <div>
          <h3 className="text-foreground font-semibold mb-1">게임 방법</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>한 명이 라이어(제시어를 모름), 나머지는 시민(제시어를 앎)</li>
            <li>돌아가며 주제에 맞는 그림을 그린다</li>
            <li>그림을 보고 투표로 라이어를 찾아낸다</li>
            <li>라이어가 적발되면 제시어 맞추기 기회가 주어진다</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">점수 체계</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>라이어 적발 + 제시어 오답: 시민 전원 +1점</li>
            <li>라이어 적발 + 제시어 정답: 라이어 +3점</li>
            <li>라이어 미적발: 라이어 +2점</li>
          </ul>
        </div>
      </GameHelpDialog>
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
      <div className="text-2xl font-display font-bold tracking-wide text-glow-cyan">최종 결과</div>

      {isDraw ? (
        <div className="text-lg text-muted-foreground">동점 무승부!</div>
      ) : (
        <div className="text-lg">
          <span className="text-primary font-bold">{winners[0].nickname}</span>님이 우승!
        </div>
      )}

      <div className="border border-border rounded-lg p-4 min-w-[250px] bg-card/50 neon-border">
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
