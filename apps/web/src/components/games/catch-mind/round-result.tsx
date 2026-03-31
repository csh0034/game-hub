"use client";

import { useState, useEffect } from "react";
import type { CatchMindPublicState } from "@game-hub/shared-types";

interface RoundResultProps {
  state: CatchMindPublicState;
  myId?: string;
  isSpectating?: boolean;
}

const NEXT_ROUND_SECONDS = 10;

export function RoundResult({ state, myId, isSpectating }: RoundResultProps) {
  const isLastRound = state.roundNumber >= state.totalRounds;
  const [countdown, setCountdown] = useState(NEXT_ROUND_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const drawer = state.players.find((p) => p.id === state.drawerId);
  const rankLabels = ["1등", "2등", "3등"];
  const rankIcons = ["🥇", "🥈", "🥉"];

  const guessers = state.guessOrder.map((id, i) => ({
    player: state.players.find((p) => p.id === id),
    rank: rankLabels[i],
    icon: rankIcons[i],
  }));

  const isDrawerMe = !isSpectating && state.drawerId === myId;
  const iGuessed = !isSpectating && guessers.some((g) => g.player?.id === myId);

  // 헤더 문구 결정
  let headerText: string;
  let headerClass: string;
  if (isSpectating) {
    headerText = guessers.length > 0 ? "라운드 종료" : "아무도 못 맞춤";
    headerClass = guessers.length > 0 ? "text-primary text-glow-cyan" : "text-accent text-glow-pink";
  } else if (isDrawerMe) {
    headerText = guessers.length > 0 ? `${guessers.length}명 정답!` : "아무도 못 맞춤";
    headerClass = guessers.length > 0 ? "text-success text-glow-cyan" : "text-accent text-glow-pink";
  } else if (iGuessed) {
    headerText = "정답!";
    headerClass = "text-success text-glow-cyan";
  } else if (guessers.length > 0) {
    headerText = "아쉽게 놓침";
    headerClass = "text-neon-yellow";
  } else {
    headerText = "아무도 못 맞춤";
    headerClass = "text-accent text-glow-pink";
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6 phase-fade-up">
      {/* 헤더 */}
      <div className="text-center">
        <div className="text-xs font-display text-muted-foreground tracking-wider uppercase mb-1">Round {state.roundNumber} Result</div>
        <div className={`text-2xl font-display font-bold tracking-wide ${headerClass}`}>
          {headerText}
        </div>
      </div>

      {/* 정보 카드 */}
      <div className="phase-scale-in w-full max-w-xs space-y-3">
        {/* 정답 */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5">
          <span className="text-xs font-display text-muted-foreground tracking-wider uppercase">정답</span>
          <span className="font-display font-bold text-primary text-lg text-glow-cyan">{state.keyword}</span>
        </div>

        {/* 출제자 */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-neon-purple/20 bg-neon-purple/5">
          <span className="text-xs font-display text-muted-foreground tracking-wider uppercase">출제자</span>
          <span className="font-bold text-neon-purple">{drawer?.nickname}</span>
        </div>

        {/* 맞춘 사람 */}
        {guessers.length > 0 && (
          <div className="space-y-1.5">
            {guessers.map(({ player, rank, icon }, i) => (
              <div
                key={player?.id}
                className={`flex items-center justify-between px-4 py-2 rounded-xl border ${
                  player?.id === myId
                    ? "border-primary/30 bg-primary/10"
                    : "border-success/15 bg-success/5"
                }`}
                style={{ animation: `phase-slide-rank 0.3s ${i * 0.1}s cubic-bezier(0.16, 1, 0.3, 1) both` }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className={`font-medium ${player?.id === myId ? "text-primary" : ""}`}>
                    {player?.nickname}
                    {player?.id === myId && " (나)"}
                  </span>
                </span>
                <span className="text-xs font-display text-success tracking-wider">{rank}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 라운드 점수 */}
      <div className="w-full max-w-xs border border-border rounded-xl p-4 bg-card/50 neon-border">
        <div className="text-xs font-display font-medium mb-3 text-center tracking-wider uppercase text-muted-foreground">라운드 점수</div>
        <div className="space-y-1.5">
          {state.players.map((player, i) => {
            const roundScore = state.roundScores[player.id] || 0;
            const guessRankIndex = state.guessOrder.indexOf(player.id);
            const rankTag = guessRankIndex >= 0 ? rankLabels[guessRankIndex] : null;
            const isMe = player.id === myId;
            return (
              <div
                key={player.id}
                className="flex justify-between items-center text-sm px-2 py-1 rounded-lg"
                style={{ animation: `phase-slide-rank 0.3s ${i * 0.08}s cubic-bezier(0.16, 1, 0.3, 1) both` }}
              >
                <span className="flex items-center gap-1.5">
                  <span className={isMe ? "text-primary font-medium" : ""}>{player.nickname}{isMe && " (나)"}</span>
                  {player.id === state.drawerId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon-purple/10 text-neon-purple font-display">출제자</span>
                  )}
                  {rankTag && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-display">{rankTag}</span>
                  )}
                </span>
                <span className={`font-mono font-bold ${roundScore > 0 ? "text-primary" : roundScore < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {roundScore > 0 ? `+${roundScore}` : roundScore < 0 ? `${roundScore}` : "0"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 카운트다운 바 */}
      <div className="w-full max-w-xs space-y-1.5">
        <div className="text-xs text-muted-foreground text-center font-display tracking-wide">
          {isLastRound ? "최종 결과까지" : "다음 라운드까지"} <span className="font-mono font-bold text-foreground">{countdown}초</span>
        </div>
        <div className="w-full h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
            style={{ animation: `progress-fill ${NEXT_ROUND_SECONDS}s linear both` }}
          />
        </div>
      </div>
    </div>
  );
}
