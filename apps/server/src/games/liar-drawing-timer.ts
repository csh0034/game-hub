const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function startLiarDrawingTimer(roomId: string, durationMs: number, onTimeout: () => void): void {
  clearLiarDrawingTimer(roomId);
  const timer = setTimeout(onTimeout, durationMs);
  timers.set(roomId, timer);
}

export function clearLiarDrawingTimer(roomId: string): void {
  const timer = timers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(roomId);
  }
}
