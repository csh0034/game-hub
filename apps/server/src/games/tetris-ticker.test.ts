import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startTetrisTicker, updateTetrisTickerInterval, clearTetrisTicker } from "./tetris-ticker.js";

describe("tetris-ticker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearTetrisTicker("room-1");
    vi.useRealTimers();
  });

  it("지정된 간격으로 onTick을 호출한다", () => {
    const onTick = vi.fn();
    startTetrisTicker("room-1", 800, onTick);

    vi.advanceTimersByTime(800);
    expect(onTick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(800);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it("clearTetrisTicker로 타이머를 정지한다", () => {
    const onTick = vi.fn();
    startTetrisTicker("room-1", 800, onTick);

    vi.advanceTimersByTime(800);
    expect(onTick).toHaveBeenCalledTimes(1);

    clearTetrisTicker("room-1");

    vi.advanceTimersByTime(1600);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("updateTetrisTickerInterval로 간격을 변경한다", () => {
    const onTick = vi.fn();
    startTetrisTicker("room-1", 800, onTick);

    vi.advanceTimersByTime(800);
    expect(onTick).toHaveBeenCalledTimes(1);

    const newOnTick = vi.fn();
    updateTetrisTickerInterval("room-1", 400, newOnTick);

    vi.advanceTimersByTime(400);
    expect(newOnTick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(400);
    expect(newOnTick).toHaveBeenCalledTimes(2);
  });

  it("존재하지 않는 방의 updateTetrisTickerInterval은 무시한다", () => {
    const onTick = vi.fn();
    updateTetrisTickerInterval("nonexistent", 400, onTick);

    vi.advanceTimersByTime(800);
    expect(onTick).not.toHaveBeenCalled();
  });

  it("startTetrisTicker를 다시 호출하면 이전 타이머를 정리한다", () => {
    const onTick1 = vi.fn();
    const onTick2 = vi.fn();

    startTetrisTicker("room-1", 800, onTick1);
    startTetrisTicker("room-1", 800, onTick2);

    vi.advanceTimersByTime(800);
    expect(onTick1).not.toHaveBeenCalled();
    expect(onTick2).toHaveBeenCalledTimes(1);
  });
});
