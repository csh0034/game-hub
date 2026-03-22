"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";

interface GameHelpDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function GameHelpDialog({ open, onClose, title, children }: GameHelpDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[25vh] p-4">
        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold">{title}</h2>
          </div>

          <div className="ml-[52px] space-y-4 text-sm text-muted-foreground">{children}</div>

          <div className="flex justify-end mt-6">
            <button
              ref={closeRef}
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
