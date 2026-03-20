export const GOMOKU_TURN_TIMEOUT_MS = 15_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function startGomokuTimer(roomId: string, onTimeout: () => void): void {
  clearGomokuTimer(roomId);
  const timer = setTimeout(onTimeout, GOMOKU_TURN_TIMEOUT_MS);
  timers.set(roomId, timer);
}

export function clearGomokuTimer(roomId: string): void {
  const timer = timers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(roomId);
  }
}
