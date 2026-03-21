"use client";

import { useState, useEffect } from "react";
import type { LiarDrawingPublicState } from "@game-hub/shared-types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

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
      const elapsed = (Date.now() - state.turnStartedAt!) / 1000;
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

  if (isLiar) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-lg font-bold text-destructive">당신이 라이어로 지목되었습니다!</div>
        <div className="text-sm text-muted-foreground">
          주제: <span className="font-bold text-foreground">{state.category}</span>
        </div>
        <div className="text-sm">제시어를 맞추면 역전 승리!</div>
        <div className="text-2xl font-mono font-bold">
          <span className={remainingTime <= 5 ? "text-destructive" : ""}>{Math.ceil(remainingTime)}초</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="제시어를 입력하세요"
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <button
            onClick={handleSubmit}
            disabled={!guess.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            제출
          </button>
        </div>
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
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="text-lg font-bold">라이어가 제시어를 추측 중입니다...</div>
      <div className="text-2xl font-mono font-bold">
        <span className={remainingTime <= 5 ? "text-destructive" : ""}>{Math.ceil(remainingTime)}초</span>
      </div>
      <div className="text-sm text-muted-foreground">잠시 기다려주세요</div>
    </div>
  );
}
