import { useEffect, useRef } from "react";
import type { TetrisMoveType } from "@game-hub/shared-types";

const DAS_DELAY = 170;
const ARR_INTERVAL = 33;
const SOFT_DROP_ARR = 33;

const DAS_MOVE_TYPES = new Set<TetrisMoveType>(["move-left", "move-right", "soft-drop"]);
const INSTANT_MOVE_TYPES = new Set<TetrisMoveType>(["hard-drop", "hold"]);

const KEY_MAP: Record<string, TetrisMoveType> = {
  ArrowLeft: "move-left",
  ArrowRight: "move-right",
  ArrowDown: "soft-drop",
  ArrowUp: "rotate-cw",
  x: "rotate-cw",
  X: "rotate-cw",
  z: "rotate-ccw",
  Z: "rotate-ccw",
  " ": "hard-drop",
  c: "hold",
  C: "hold",
  Shift: "hold",
};

interface KeyState {
  dasTimer: ReturnType<typeof setTimeout> | null;
  arrTimer: ReturnType<typeof setInterval> | null;
}

export function useTetrisInput(options: {
  enabled: boolean;
  onMove: (moveType: TetrisMoveType) => void;
  onInstantMove: (moveType: TetrisMoveType) => void;
}) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!options.enabled) return;

    const pressedKeys = new Map<string, KeyState>();

    const clearKeyTimers = (key: string) => {
      const state = pressedKeys.get(key);
      if (state) {
        if (state.dasTimer) clearTimeout(state.dasTimer);
        if (state.arrTimer) clearInterval(state.arrTimer);
        pressedKeys.delete(key);
      }
    };

    const clearAllTimers = () => {
      for (const key of pressedKeys.keys()) {
        clearKeyTimers(key);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const moveType = KEY_MAP[e.key];
      if (!moveType) return;
      e.preventDefault();

      // Ignore OS key repeats — we handle our own repeats
      if (e.repeat) return;

      // Clean up any existing timers for this key
      clearKeyTimers(e.key);

      if (INSTANT_MOVE_TYPES.has(moveType)) {
        optionsRef.current.onInstantMove(moveType);
        return;
      }

      // Fire immediately on first press
      if (DAS_MOVE_TYPES.has(moveType)) {
        optionsRef.current.onMove(moveType);
        const arrMs = moveType === "soft-drop" ? SOFT_DROP_ARR : ARR_INTERVAL;
        const dasTimer = setTimeout(() => {
          const keyState = pressedKeys.get(e.key);
          if (!keyState) return;
          keyState.dasTimer = null;
          keyState.arrTimer = setInterval(() => {
            optionsRef.current.onMove(moveType);
          }, arrMs);
        }, DAS_DELAY);
        pressedKeys.set(e.key, { dasTimer, arrTimer: null });
      } else {
        // Rotation: fire once, no repeat
        optionsRef.current.onMove(moveType);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      clearKeyTimers(e.key);
    };

    const handleBlur = () => {
      clearAllTimers();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      clearAllTimers();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [options.enabled]);
}
