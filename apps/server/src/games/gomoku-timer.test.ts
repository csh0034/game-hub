import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startGomokuTimer, clearGomokuTimer, GOMOKU_TURN_TIMEOUT_MS } from "./gomoku-timer.js";

describe("gomoku-timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearGomokuTimer("room-1");
    vi.useRealTimers();
  });

  it("GOMOKU_TURN_TIMEOUT_MS는 15000이다", () => {
    expect(GOMOKU_TURN_TIMEOUT_MS).toBe(15_000);
  });

  it("타임아웃 시 콜백을 호출한다", () => {
    const callback = vi.fn();
    startGomokuTimer("room-1", callback);

    vi.advanceTimersByTime(14_999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("clearGomokuTimer로 타이머를 취소한다", () => {
    const callback = vi.fn();
    startGomokuTimer("room-1", callback);

    clearGomokuTimer("room-1");
    vi.advanceTimersByTime(20_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("startGomokuTimer를 다시 호출하면 이전 타이머를 취소한다", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    startGomokuTimer("room-1", callback1);
    startGomokuTimer("room-1", callback2);

    vi.advanceTimersByTime(15_000);
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledOnce();
  });

  it("다른 roomId의 타이머는 독립적이다", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    startGomokuTimer("room-1", callback1);
    startGomokuTimer("room-2", callback2);

    clearGomokuTimer("room-1");
    vi.advanceTimersByTime(15_000);

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledOnce();

    clearGomokuTimer("room-2");
  });

  it("존재하지 않는 타이머를 clear해도 에러가 발생하지 않는다", () => {
    expect(() => clearGomokuTimer("nonexistent")).not.toThrow();
  });
});
