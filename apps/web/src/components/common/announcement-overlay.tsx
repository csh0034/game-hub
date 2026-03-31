"use client";

import { useEffect, useRef } from "react";
import { Megaphone, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AnnouncementOverlayProps {
  message: string | null;
  receivedAt: number | null;
  onClose: () => void;
}

export function AnnouncementOverlay({
  message,
  receivedAt,
  onClose,
}: AnnouncementOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (message) {
      closeRef.current?.focus();
    }
  }, [message]);

  useEffect(() => {
    if (!message) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[25vh] p-4" onClick={onClose}>
        <div className="bg-card border-2 border-neon-purple/50 rounded-2xl p-8 w-full max-w-md shadow-[0_0_40px_rgba(168,85,247,0.15)]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-neon-purple/15 flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-neon-purple" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-[family-name:var(--font-display)] text-neon-purple tracking-wide">공지사항</h2>
                <span className="text-xs text-muted-foreground">{receivedAt ? formatDateTime(receivedAt) : ""}</span>
              </div>
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
            {message}
          </p>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-neon-purple hover:bg-neon-purple/90 text-white transition-all shadow-[0_0_12px_rgba(168,85,247,0.2)] hover:shadow-[0_0_18px_rgba(168,85,247,0.3)]"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
