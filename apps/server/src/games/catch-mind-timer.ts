const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function startCatchMindTimer(roomId: string, durationMs: number, onTimeout: () => void): void {
  clearCatchMindTimer(roomId);
  const timer = setTimeout(onTimeout, durationMs);
  timers.set(roomId, timer);
}

export function clearCatchMindTimer(roomId: string): void {
  const timer = timers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(roomId);
  }
}
