"use client";

import { useState, useEffect, useRef } from "react";

interface PlacardDialogProps {
  open: boolean;
  currentItems: string[];
  onClose: () => void;
  onSubmit: (items: string[]) => void;
}

const MAX_LENGTH = 50;
const MAX_ITEMS = 5;

export function PlacardDialog({ open, currentItems, onClose, onSubmit }: PlacardDialogProps) {
  const [items, setItems] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  if (open && !initialized) {
    setItems(currentItems.length > 0 ? [...currentItems] : [""]);
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

  const updateItem = (index: number, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? value.slice(0, MAX_LENGTH) : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, ""]);
    setTimeout(() => newInputRef.current?.focus(), 0);
  };

  const handleSubmit = () => {
    const filtered = items.map((item) => item.trim()).filter((item) => item.length > 0);
    onSubmit(filtered);
  };

  if (!open) return null;

  const validCount = items.filter((item) => item.trim().length > 0).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[25vh] p-4">
        <div className="bg-card border border-neon-cyan/20 rounded-xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(0,229,255,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">플랜카드</h2>
            <span className="text-xs text-muted-foreground">{validCount}/{MAX_ITEMS}</span>
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    ref={index === items.length - 1 ? newInputRef : undefined}
                    autoFocus={index === 0 && items.length === 1}
                    type="text"
                    value={item}
                    onChange={(e) => updateItem(index, e.target.value)}
                    placeholder="배너에 표시할 문구를 입력하세요"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/30"
                  />
                  <p className="text-xs text-muted-foreground text-right mt-0.5">
                    {item.length}/{MAX_LENGTH}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="mt-2 text-muted-foreground hover:text-red-400 transition-colors text-sm shrink-0"
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {items.length < MAX_ITEMS && (
            <button
              onClick={addItem}
              className="w-full mt-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-neon-cyan/40 hover:text-neon-cyan/70 transition-colors"
            >
              + 추가
            </button>
          )}

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
              {validCount > 0 ? "적용" : "삭제"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
