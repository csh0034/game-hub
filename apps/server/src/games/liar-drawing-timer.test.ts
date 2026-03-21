import { describe, it, expect, vi, beforeEach } from "vitest";
import { startLiarDrawingTimer, clearLiarDrawingTimer } from "./liar-drawing-timer.js";

describe("LiarDrawingTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("지정 시간 후 콜백을 호출한다", () => {
    const callback = vi.fn();
    startLiarDrawingTimer("room-1", 5000, callback);

    vi.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("타이머를 해제하면 콜백이 호출되지 않는다", () => {
    const callback = vi.fn();
    startLiarDrawingTimer("room-1", 5000, callback);
    clearLiarDrawingTimer("room-1");

    vi.advanceTimersByTime(10000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("같은 방에 새 타이머를 시작하면 이전 타이머가 대체된다", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    startLiarDrawingTimer("room-1", 5000, callback1);
    startLiarDrawingTimer("room-1", 3000, callback2);

    vi.advanceTimersByTime(5000);
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("존재하지 않는 방의 타이머를 해제해도 에러가 발생하지 않는다", () => {
    expect(() => clearLiarDrawingTimer("nonexistent")).not.toThrow();
  });
});
