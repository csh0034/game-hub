"use client";

import { useState, useEffect } from "react";
import type { LiarDrawingPublicState } from "@game-hub/shared-types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { getServerElapsed } from "@/lib/socket";

interface LiarGuessPanelProps {
  state: LiarDrawingPublicState;
  myId: string;
  onGuess: (guess: string) => void;
}

export function LiarGuessPanel({ state, myId, onGuess }: LiarGuessPanelProps) {
  const [guess, setGuess] = useState("");
  const [remainingTime, setRemainingTime] = useState(30);
  const [showConfirm, setShowConfirm] = useState(false);
  const isLiar = state.liarId === myId;

  useEffect(() => {
    if (!state.turnStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = getServerElapsed(state.turnStartedAt!) / 1000;
      setRemainingTime(Math.max(0, 30 - elapsed));
    }, 200);
    return () => clearInterval(interval);
  }, [state.turnStartedAt]);

  const handleSubmit = () => {
    if (guess.trim() && isLiar) {
      setShowConfirm(true);
    }
  };

  const handleConfirmGuess = () => {
    onGuess(guess.trim());
    setShowConfirm(false);
  };

  const timerColor = remainingTime <= 5 ? "text-accent" : remainingTime <= 10 ? "text-neon-yellow" : "text-primary";
  const progressPct = (remainingTime / 30) * 100;

  if (isLiar) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 phase-fade-up">
        {/* 경고 카드 */}
        <div className="relative px-8 py-6 rounded-2xl border border-accent/30 bg-accent/5 text-center neon-pulse-pink">
          <div className="text-4xl mb-3">🎭</div>
          <div className="text-xl font-display font-bold text-accent text-glow-pink mb-1">지목되었습니다!</div>
          <div className="text-sm text-muted-foreground">
            주제: <span className="font-bold text-foreground">{state.category}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">제시어를 맞추면 역전 승리!</div>
        </div>

        {/* 타이머 */}
        <div className="w-full max-w-sm space-y-2">
          <div className={`text-center text-3xl font-mono font-black tabular-nums ${timerColor} ${remainingTime <= 5 ? "animate-pulse" : ""}`}>
            {Math.ceil(remainingTime)}<span className="text-sm font-normal text-muted-foreground ml-1">초</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${remainingTime <= 5 ? "bg-accent" : remainingTime <= 10 ? "bg-neon-yellow" : "bg-primary"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 입력 */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          className="flex gap-2 w-full max-w-sm"
        >
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="제시어를 입력하세요"
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all"
            autoFocus
          />
          <button
            type="submit"
            disabled={!guess.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-display font-medium tracking-wide bg-gradient-to-r from-neon-cyan to-neon-purple text-primary-foreground disabled:opacity-40 hover:shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all"
          >
            제출
          </button>
        </form>
        <ConfirmDialog
          open={showConfirm}
          title="정답 제출"
          message={`'${guess.trim()}'(을)를 정답으로 제출하시겠습니까?`}
          confirmText="제출"
          cancelText="취소"
          onConfirm={handleConfirmGuess}
          onCancel={() => setShowConfirm(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-8 phase-fade-up">
      <div className="relative px-8 py-6 rounded-2xl border border-neon-yellow/20 bg-neon-yellow/5 text-center">
        <div className="text-4xl mb-3">⏳</div>
        <div className="text-lg font-display font-bold">라이어가 추측 중...</div>
        <div className="text-sm text-muted-foreground mt-1">잠시 기다려주세요</div>
      </div>

      <div className={`text-3xl font-mono font-black tabular-nums ${timerColor} ${remainingTime <= 5 ? "animate-pulse" : ""}`}>
        {Math.ceil(remainingTime)}<span className="text-sm font-normal text-muted-foreground ml-1">초</span>
      </div>
    </div>
  );
}
