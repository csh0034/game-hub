"use client";

import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";

interface ResolveDialogProps {
  open: boolean;
  onConfirm: (commitHash: string) => void;
  onCancel: () => void;
}

export function ResolveDialog({ open, onConfirm, onCancel }: ResolveDialogProps) {
  if (!open) return null;

  return <ResolveDialogInner onConfirm={onConfirm} onCancel={onCancel} />;
}

function ResolveDialogInner({
  onConfirm,
  onCancel,
}: Omit<ResolveDialogProps, "open">) {
  const [commitHash, setCommitHash] = useState("");

  const handleFocus = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commitHash.trim()) {
      onConfirm(commitHash.trim());
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[30vh] p-4">
        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="w-5 h-5 text-success" />
            </div>
            <h2 className="text-lg font-bold">요청사항 완료 처리</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-sm text-muted-foreground mb-2 ml-[52px]">
              커밋 해시를 입력해주세요
            </label>
            <input
              ref={handleFocus}
              type="text"
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
              placeholder="예: a1b2c3d"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary mb-4 font-mono"
            />

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!commitHash.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-success hover:bg-success/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                완료
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
