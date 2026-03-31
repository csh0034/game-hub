"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = "확인",
  message,
  confirmText = "나가기",
  cancelText = "취소",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] p-4">
        <div className="bg-card border border-neon-yellow/20 rounded-xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(251,191,36,0.08)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neon-yellow/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-neon-yellow" />
            </div>
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">{title}</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-6 ml-[52px]">
            {message}
          </p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-neon-pink hover:bg-neon-pink/90 text-white transition-all shadow-[0_0_10px_rgba(255,45,111,0.2)] hover:shadow-[0_0_15px_rgba(255,45,111,0.3)]"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
