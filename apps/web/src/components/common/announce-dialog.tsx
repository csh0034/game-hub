"use client";

import { useState, useEffect } from "react";

interface AnnounceDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
}

export function AnnounceDialog({ open, onClose, onSubmit }: AnnounceDialogProps) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setMessage("");
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[30vh] p-4">
        <div className="bg-card border border-neon-cyan/20 rounded-xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(0,229,255,0.08)]">
          <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">공지하기</h2>

          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
            placeholder="공지 내용을 입력하세요"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/30"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">
            {message.length}/200
          </p>

          <div className="flex gap-3 justify-end mt-4">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!message.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-neon-cyan/90 hover:bg-neon-cyan text-background transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_10px_rgba(0,229,255,0.2)]"
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
