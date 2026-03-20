"use client";

import { useState } from "react";
import { Gamepad2 } from "lucide-react";
import { getSocket } from "@/lib/socket";

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
    socket.emit("player:set-nickname", trimmed, (result) => {
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
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-500 rounded-xl flex items-center justify-center">
              <Gamepad2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Game Hub
            </span>
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
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {displayError && (
                <p className="mt-2 text-sm text-destructive">{displayError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg px-4 py-3 text-base transition-colors cursor-pointer"
            >
              {isSubmitting ? "확인 중..." : "시작하기"}
            </button>
          </form>
        </div>
      </div>
      <span className="absolute bottom-4 right-4 text-xs text-muted-foreground">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
        <span className="ml-1 opacity-60">({process.env.NEXT_PUBLIC_COMMIT_HASH})</span>
      </span>
    </div>
  );
}
