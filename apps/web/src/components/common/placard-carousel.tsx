"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PlacardCarouselProps {
  items: string[];
}

export function PlacardCarousel({ items }: PlacardCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const dragStartX = useRef<number | null>(null);
  const resetTimerRef = useRef(0);

  const safeIndex = currentIndex < items.length ? currentIndex : 0;

  const goTo = useCallback((nextIndex: number, dir: "left" | "right") => {
    if (isTransitioning) return;
    setDirection(dir);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsTransitioning(false);
    }, 400);
  }, [isTransitioning]);

  const goNext = useCallback(() => {
    goTo((safeIndex + 1) % items.length, "left");
  }, [goTo, safeIndex, items.length]);

  const goPrev = useCallback(() => {
    goTo((safeIndex - 1 + items.length) % items.length, "right");
  }, [goTo, safeIndex, items.length]);

  // 수동 조작 시 자동 슬라이드 타이머 리셋
  const manualNav = useCallback((fn: () => void) => {
    fn();
    resetTimerRef.current += 1;
  }, []);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const id = setInterval(goNext, 4000);
    return () => clearInterval(id);
    // resetTimerRef.current 변경 시 타이머 재시작
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, paused, goNext, resetTimerRef.current]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const diff = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(diff) < 30) return;
    manualNav(diff < 0 ? goNext : goPrev);
  };

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <div className="px-4 py-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/20 text-sm text-center font-medium text-neon-cyan/90 shadow-[0_0_15px_rgba(0,229,255,0.05)]">
        {items[0]}
      </div>
    );
  }

  const slideOut = direction === "left" ? "-translate-x-5" : "translate-x-5";

  return (
    <div
      className="group relative px-4 py-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/20 shadow-[0_0_15px_rgba(0,229,255,0.05)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <button
        onClick={() => manualNav(goPrev)}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-neon-cyan/60 hover:text-neon-cyan text-lg leading-none select-none"
        aria-label="이전"
      >
        ‹
      </button>

      <div className="overflow-hidden mx-4">
        <div
          className={`text-sm text-center font-medium text-neon-cyan/90 transition-all duration-400 ease-in-out ${
            isTransitioning ? `opacity-0 ${slideOut}` : "opacity-100 translate-x-0"
          }`}
        >
          {items[safeIndex]}
        </div>
      </div>

      <button
        onClick={() => manualNav(goNext)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-neon-cyan/60 hover:text-neon-cyan text-lg leading-none select-none"
        aria-label="다음"
      >
        ›
      </button>

      <div className="flex justify-center gap-1.5 mt-2">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (i === safeIndex) return;
              manualNav(() => goTo(i, i > safeIndex ? "left" : "right"));
            }}
            className={`inline-block w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i === safeIndex ? "bg-neon-cyan" : "bg-neon-cyan/25 hover:bg-neon-cyan/50"
            }`}
            aria-label={`${i + 1}번째 플랜카드`}
          />
        ))}
      </div>
    </div>
  );
}
