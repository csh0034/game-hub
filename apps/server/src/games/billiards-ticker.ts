import { BROADCAST_INTERVAL } from "./billiards-physics.js";

const tickers = new Map<string, ReturnType<typeof setInterval>>();
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function startBilliardsTicker(roomId: string, onTick: () => void): void {
  clearBilliardsTicker(roomId);
  const timer = setInterval(onTick, BROADCAST_INTERVAL);
  tickers.set(roomId, timer);
}

export function clearBilliardsTicker(roomId: string): void {
  const timer = tickers.get(roomId);
  if (timer) {
    clearInterval(timer);
    tickers.delete(roomId);
  }
}

export function startBilliardsTurnTimer(roomId: string, timeMs: number, onTimeout: () => void): void {
  clearBilliardsTurnTimer(roomId);
  const timer = setTimeout(onTimeout, timeMs);
  turnTimers.set(roomId, timer);
}

export function clearBilliardsTurnTimer(roomId: string): void {
  const timer = turnTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(roomId);
  }
}

export function clearAllBilliardsTimers(roomId: string): void {
  clearBilliardsTicker(roomId);
  clearBilliardsTurnTimer(roomId);
}
