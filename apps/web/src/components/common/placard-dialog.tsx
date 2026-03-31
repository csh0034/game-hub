"use client";

import { useState, useEffect } from "react";

interface PlacardDialogProps {
  open: boolean;
  currentText: string | null;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function PlacardDialog({ open, currentText, onClose, onSubmit }: PlacardDialogProps) {
  const [text, setText] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (open && !initialized) {
    setText(currentText ?? "");
    setInitialized(true);
  }
  if (!open && initialized) {
    setInitialized(false);
  }

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

  const handleSubmit = () => {
    onSubmit(text);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[30vh] p-4">
        <div className="bg-card border border-neon-cyan/20 rounded-xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(0,229,255,0.08)]">
          <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">플랜카드</h2>

          <input
            autoFocus
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 50))}
            placeholder="배너에 표시할 문구를 입력하세요"
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/30"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">
            {text.length}/50
          </p>

          <div className="flex gap-3 justify-end mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-neon-cyan/90 hover:bg-neon-cyan text-background transition-all hover:shadow-[0_0_10px_rgba(0,229,255,0.2)]"
            >
              {text.trim() ? "적용" : "삭제"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
