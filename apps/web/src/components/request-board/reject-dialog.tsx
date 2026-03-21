"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface RejectDialogProps {
  open: boolean;
  onConfirm: (adminResponse: string) => void;
  onCancel: () => void;
}

export function RejectDialog({ open, onConfirm, onCancel }: RejectDialogProps) {
  if (!open) return null;

  return <RejectDialogInner onConfirm={onConfirm} onCancel={onCancel} />;
}

function RejectDialogInner({
  onConfirm,
  onCancel,
}: Omit<RejectDialogProps, "open">) {
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
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center">
              <X className="w-5 h-5 text-destructive" />
            </div>
            <h2 className="text-lg font-bold">요청사항 거부</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-sm text-muted-foreground mb-2 ml-[52px]">
              거부 사유를 입력해주세요
            </label>
            <textarea
              ref={handleFocus}
              value={adminResponse}
              onChange={(e) => setAdminResponse(e.target.value)}
              placeholder="거부 사유"
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
                className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                거부
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
