import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startTypingTicker, updateTypingTickerInterval, clearTypingTicker } from "./typing-ticker.js";

describe("typing-ticker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearTypingTicker("room-1");
    clearTypingTicker("room-2");
    vi.useRealTimers();
  });

  describe("startTypingTicker", () => {
    it("지정된 간격으로 onTick을 호출한다", () => {
      const onTick = vi.fn();
      startTypingTicker("room-1", 500, onTick);

      vi.advanceTimersByTime(500);
      expect(onTick).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);
      expect(onTick).toHaveBeenCalledTimes(2);
    });

    it("같은 roomId로 재시작하면 이전 타이머를 정리한다", () => {
      const onTick1 = vi.fn();
      const onTick2 = vi.fn();

      startTypingTicker("room-1", 500, onTick1);
      startTypingTicker("room-1", 500, onTick2);

      vi.advanceTimersByTime(500);
      expect(onTick1).not.toHaveBeenCalled();
      expect(onTick2).toHaveBeenCalledTimes(1);
    });

    it("다른 roomId는 독립적으로 동작한다", () => {
      const onTick1 = vi.fn();
      const onTick2 = vi.fn();

      startTypingTicker("room-1", 500, onTick1);
      startTypingTicker("room-2", 300, onTick2);

      vi.advanceTimersByTime(600);
      expect(onTick1).toHaveBeenCalledTimes(1);
      expect(onTick2).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateTypingTickerInterval", () => {
    it("활성 타이머의 간격을 변경한다", () => {
      const onTick1 = vi.fn();
      startTypingTicker("room-1", 500, onTick1);

      const onTick2 = vi.fn();
      updateTypingTickerInterval("room-1", 200, onTick2);

      vi.advanceTimersByTime(200);
      expect(onTick2).toHaveBeenCalledTimes(1);
    });

    it("존재하지 않는 roomId는 무시한다", () => {
      const onTick = vi.fn();
      updateTypingTickerInterval("nonexistent", 200, onTick);

      vi.advanceTimersByTime(1000);
      expect(onTick).not.toHaveBeenCalled();
    });
  });

  describe("clearTypingTicker", () => {
    it("활성 타이머를 정리한다", () => {
      const onTick = vi.fn();
      startTypingTicker("room-1", 500, onTick);

      clearTypingTicker("room-1");

      vi.advanceTimersByTime(1000);
      expect(onTick).not.toHaveBeenCalled();
    });

    it("존재하지 않는 roomId는 에러 없이 무시한다", () => {
      expect(() => clearTypingTicker("nonexistent")).not.toThrow();
    });
  });
});
