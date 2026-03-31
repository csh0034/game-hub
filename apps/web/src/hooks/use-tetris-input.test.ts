import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTetrisInput } from "./use-tetris-input";

describe("useTetrisInput", () => {
  const onMove = vi.fn();
  const onInstantMove = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onMove.mockClear();
    onInstantMove.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function pressKey(code: string) {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
  }

  function releaseKey(code: string) {
    window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
  }

  function pressKeyRepeat(code: string) {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true, repeat: true }));
  }

  it("첫 키 입력 시 즉시 onMove를 호출한다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("ArrowLeft");

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("move-left");

    releaseKey("ArrowLeft");
  });

  it("DAS 딜레이(170ms) 후 ARR 반복이 시작된다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("ArrowRight");
    expect(onMove).toHaveBeenCalledTimes(1);

    // DAS 딜레이 전에는 추가 호출 없음
    vi.advanceTimersByTime(169);
    expect(onMove).toHaveBeenCalledTimes(1);

    // DAS 만료 후 ARR 시작 (33ms 간격)
    vi.advanceTimersByTime(1); // 170ms
    expect(onMove).toHaveBeenCalledTimes(1); // DAS 만료 시점에는 아직 안 됨

    vi.advanceTimersByTime(33); // 203ms — 첫 ARR 반복
    expect(onMove).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(33); // 236ms — 두 번째 ARR 반복
    expect(onMove).toHaveBeenCalledTimes(3);

    releaseKey("ArrowRight");
  });

  it("키를 놓으면 ARR 반복이 멈춘다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("ArrowLeft");
    vi.advanceTimersByTime(170 + 33); // DAS + 1 ARR
    expect(onMove).toHaveBeenCalledTimes(2); // 초기 1 + ARR 1

    releaseKey("ArrowLeft");

    vi.advanceTimersByTime(100); // 추가 시간 경과
    expect(onMove).toHaveBeenCalledTimes(2); // 더 이상 호출 없음
  });

  it("OS 키 반복(repeat)은 무시한다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("ArrowLeft");
    pressKeyRepeat("ArrowLeft");
    pressKeyRepeat("ArrowLeft");

    expect(onMove).toHaveBeenCalledTimes(1);

    releaseKey("ArrowLeft");
  });

  it("hard-drop은 onInstantMove를 호출하고 반복하지 않는다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("Space");
    expect(onInstantMove).toHaveBeenCalledTimes(1);
    expect(onInstantMove).toHaveBeenCalledWith("hard-drop");
    expect(onMove).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onInstantMove).toHaveBeenCalledTimes(1);
  });

  it("hold는 onInstantMove를 호출한다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("KeyC");
    expect(onInstantMove).toHaveBeenCalledWith("hold");
  });

  it("회전은 1회만 실행되고 반복하지 않는다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("ArrowUp");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("rotate-cw");

    vi.advanceTimersByTime(500);
    expect(onMove).toHaveBeenCalledTimes(1); // 반복 없음

    releaseKey("ArrowUp");
  });

  it("enabled가 false이면 입력을 처리하지 않는다", () => {
    renderHook(() => useTetrisInput({ enabled: false, onMove, onInstantMove }));

    pressKey("ArrowLeft");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("blur 시 모든 타이머가 해제된다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("ArrowLeft");
    vi.advanceTimersByTime(100); // DAS 진행 중

    window.dispatchEvent(new Event("blur"));

    vi.advanceTimersByTime(500);
    expect(onMove).toHaveBeenCalledTimes(1); // 초기 1회만
  });

  it("soft-drop에도 DAS/ARR이 적용된다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    pressKey("ArrowDown");
    expect(onMove).toHaveBeenCalledWith("soft-drop");

    vi.advanceTimersByTime(170 + 33);
    expect(onMove).toHaveBeenCalledTimes(2);

    releaseKey("ArrowDown");
  });

  it("한글 IME 활성 시에도 Space 키가 동작한다", () => {
    renderHook(() => useTetrisInput({ enabled: true, onMove, onInstantMove }));

    // IME 활성 시 e.key는 "Process"이지만 e.code는 "Space"
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code: "Space", bubbles: true }));
    expect(onInstantMove).toHaveBeenCalledTimes(1);
    expect(onInstantMove).toHaveBeenCalledWith("hard-drop");
  });
});
