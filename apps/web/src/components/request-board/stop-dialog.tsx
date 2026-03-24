"use client";

import { useState, useEffect, useCallback } from "react";
import { Ban } from "lucide-react";

interface StopDialogProps {
  open: boolean;
  onConfirm: (adminResponse: string) => void;
  onCancel: () => void;
}

export function StopDialog({ open, onConfirm, onCancel }: StopDialogProps) {
  if (!open) return null;

  return <StopDialogInner onConfirm={onConfirm} onCancel={onCancel} />;
}

function StopDialogInner({
  onConfirm,
  onCancel,
}: Omit<StopDialogProps, "open">) {
  const [adminResponse, setAdminResponse] = useState("");

  const handleFocus = useCallback((node: HTMLTextAreaElement | null) => {
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
    if (adminResponse.trim()) {
      onConfirm(adminResponse.trim());
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[30vh] p-4">
        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center">
              <Ban className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold">요청사항 중단</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-sm text-muted-foreground mb-2 ml-[52px]">
              중단 사유를 입력해주세요
            </label>
            <textarea
              ref={handleFocus}
              value={adminResponse}
              onChange={(e) => setAdminResponse(e.target.value)}
              placeholder="중단 사유"
              rows={3}
              maxLength={500}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary mb-4 resize-none"
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
                disabled={!adminResponse.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-500/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                중단
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
