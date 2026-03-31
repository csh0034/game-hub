"use client";

import { useState, useEffect } from "react";
import type { LiarDrawingPublicState } from "@game-hub/shared-types";

interface RoundResultProps {
  state: LiarDrawingPublicState;
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

  const liar = state.players.find((p) => p.id === state.liarId);
  const accused = state.accusedPlayerId ? state.players.find((p) => p.id === state.accusedPlayerId) : null;
  const liarCaught = state.accusedPlayerId === state.liarId;
  const isLiarMe = !isSpectating && state.liarId === myId;

  const liarGuessedCorrectly = liarCaught && state.liarGuessCorrect;

  // 헤더 문구 결정
  let headerText: string;
  let headerClass: string;
  if (isSpectating) {
    headerText = liarGuessedCorrectly ? "라이어 역전!" : liarCaught ? "라이어 적발" : "라이어 생존";
    headerClass = liarGuessedCorrectly ? "text-neon-yellow" : liarCaught ? "text-primary text-glow-cyan" : "text-accent text-glow-pink";
  } else if (isLiarMe) {
    headerText = liarGuessedCorrectly ? "역전 성공!" : liarCaught ? "적발당했다!" : "생존 성공!";
    headerClass = liarGuessedCorrectly ? "text-success text-glow-cyan" : liarCaught ? "text-accent text-glow-pink" : "text-success text-glow-cyan";
  } else {
    // 시민
    headerText = liarGuessedCorrectly ? "라이어에게 역전당했다!" : liarCaught ? "라이어 적발!" : "라이어를 놓쳤다!";
    headerClass = liarGuessedCorrectly ? "text-accent text-glow-pink" : liarCaught ? "text-success text-glow-cyan" : "text-accent text-glow-pink";
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
        {state.keyword && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5">
            <span className="text-xs font-display text-muted-foreground tracking-wider uppercase">정답</span>
            <span className="font-display font-bold text-primary text-lg text-glow-cyan">{state.keyword}</span>
          </div>
        )}

        {/* 라이어 */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
          isLiarMe ? "border-accent/30 bg-accent/10" : "border-accent/20 bg-accent/5"
        }`}>
          <span className="text-xs font-display text-muted-foreground tracking-wider uppercase">라이어</span>
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-accent">{liar?.nickname}</span>
            {isLiarMe && <span className="text-[10px] text-accent/60">(나)</span>}
          </span>
        </div>

        {/* 지목 결과 */}
        {accused ? (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
            liarCaught ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
          }`}>
            <span className="text-xs font-display text-muted-foreground tracking-wider uppercase">지목</span>
            <span className="flex items-center gap-2">
              <span className={`font-bold ${accused.id === myId ? "text-primary" : ""}`}>
                {accused.nickname}{accused.id === myId && " (나)"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-display font-medium ${
                liarCaught ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              }`}>
                {liarCaught ? "적중" : "오답"}
              </span>
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center px-4 py-2.5 rounded-xl border border-border bg-card/30 text-sm text-muted-foreground">
            동률로 라이어 지목 실패
          </div>
        )}

        {/* 라이어 추측 */}
        {liarCaught && state.liarGuess !== null && (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
            state.liarGuessCorrect ? "border-accent/20 bg-accent/5" : "border-success/20 bg-success/5"
          }`}>
            <span className="text-xs font-display text-muted-foreground tracking-wider uppercase">추측</span>
            <span className="flex items-center gap-2">
              <span className="font-bold">&quot;{state.liarGuess || "(미입력)"}&quot;</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-display font-medium ${
                state.liarGuessCorrect ? "bg-accent/15 text-accent" : "bg-success/15 text-success"
              }`}>
                {state.liarGuessCorrect ? "역전!" : "오답"}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* 라운드 점수 */}
      <div className="w-full max-w-xs border border-border rounded-xl p-4 bg-card/50 neon-border">
        <div className="text-xs font-display font-medium mb-3 text-center tracking-wider uppercase text-muted-foreground">라운드 점수</div>
        <div className="space-y-1.5">
          {state.players.map((player, i) => {
            const roundScore = state.roundScores[player.id] || 0;
            const isMe = player.id === myId;
            return (
              <div
                key={player.id}
                className="flex justify-between items-center text-sm px-2 py-1 rounded-lg"
                style={{ animation: `phase-slide-rank 0.3s ${i * 0.08}s cubic-bezier(0.16, 1, 0.3, 1) both` }}
              >
                <span className="flex items-center gap-1.5">
                  <span className={isMe ? "text-primary font-medium" : ""}>{player.nickname}{isMe && " (나)"}</span>
                  {player.id === state.liarId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-display">LIAR</span>
                  )}
                </span>
                <span className={`font-mono font-bold ${roundScore > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {roundScore > 0 ? `+${roundScore}` : "0"}
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
