"use client";

import { useState } from "react";
import { Gamepad2 } from "lucide-react";
import { getSocket, getBrowserId } from "@/lib/socket";

interface NicknameFormProps {
  onComplete: (nickname: string) => void;
}

export function NicknameForm({ onComplete }: NicknameFormProps) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientError = (() => {
    const trimmed = nickname.trim();
    if (trimmed.length > 0 && trimmed.length < 3) return "3자 이상 입력해주세요.";
    if (trimmed.length > 20) return "20자 이하로 입력해주세요.";
    return "";
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed.length < 3 || trimmed.length > 20) return;

    setIsSubmitting(true);
    setError("");

    const socket = getSocket();
    socket.emit("player:set-nickname", trimmed, getBrowserId(), (result) => {
      setIsSubmitting(false);
      if (result.success) {
        onComplete(trimmed);
      } else {
        setError(result.error ?? "닉네임 설정에 실패했습니다.");
      }
    });
  };

  const displayError = error || clientError;
  const canSubmit = nickname.trim().length >= 3 && nickname.trim().length <= 20 && !isSubmitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-neon-purple/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm mx-auto px-4 relative">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-neon-cyan to-neon-purple rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.3)] neon-pulse">
              <Gamepad2 className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-4xl font-bold font-[family-name:var(--font-display)] bg-gradient-to-r from-neon-cyan via-primary to-neon-purple bg-clip-text text-transparent text-glow-cyan tracking-widest">
              GAME HUB
            </h1>
            <p className="text-sm text-muted-foreground tracking-wide">멀티플레이 게임의 시작</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError("");
                }}
                placeholder="닉네임을 입력하세요"
                maxLength={20}
                autoFocus
                className="w-full bg-secondary/80 border border-neon-cyan/20 rounded-lg px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/50 placeholder:text-muted-foreground transition-all"
              />
              {displayError && (
                <p className="mt-2 text-sm text-neon-pink">{displayError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-gradient-to-r from-neon-cyan to-primary hover:from-neon-cyan hover:to-neon-cyan disabled:opacity-40 disabled:cursor-not-allowed text-background font-bold rounded-lg px-4 py-3 text-base transition-all shadow-[0_0_15px_rgba(0,229,255,0.2)] hover:shadow-[0_0_25px_rgba(0,229,255,0.4)] cursor-pointer font-[family-name:var(--font-display)] tracking-wider"
            >
              {isSubmitting ? "확인 중..." : "START"}
            </button>
          </form>
        </div>
      </div>
      <span className="absolute bottom-4 right-4 text-xs text-muted-foreground/50">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
        <span className="ml-1 opacity-60">({process.env.NEXT_PUBLIC_COMMIT_HASH})</span>
      </span>
    </div>
  );
}
