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
            isSpectating={isSpectating}
            liarNickname={isSpectating && liarPrivateState?.liarId ? state.players.find((p) => p.id === liarPrivateState.liarId)?.nickname : undefined}
          />
        );
      case "drawing":
        return (
          <DrawingPhase
            state={state}
            socket={socket}
            myId={myId}
            keyword={liarPrivateState?.keyword ?? null}
            isSpectating={isSpectating}
            liarNickname={isSpectating && liarPrivateState?.liarId ? state.players.find((p) => p.id === liarPrivateState.liarId)?.nickname : undefined}
          />
        );
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
