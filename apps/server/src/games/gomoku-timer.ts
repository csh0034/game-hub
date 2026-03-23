const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function startGomokuTimer(roomId: string, timeoutMs: number, onTimeout: () => void): void {
  clearGomokuTimer(roomId);
  const timer = setTimeout(onTimeout, timeoutMs);
  timers.set(roomId, timer);
}

export function clearGomokuTimer(roomId: string): void {
  const timer = timers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(roomId);
  }
}
