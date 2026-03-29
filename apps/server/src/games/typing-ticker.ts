const tickers = new Map<string, ReturnType<typeof setInterval>>();

export function startTypingTicker(roomId: string, intervalMs: number, onTick: () => void): void {
  clearTypingTicker(roomId);
  const timer = setInterval(onTick, intervalMs);
  tickers.set(roomId, timer);
}

export function updateTypingTickerInterval(roomId: string, intervalMs: number, onTick: () => void): void {
  if (!tickers.has(roomId)) return;
  startTypingTicker(roomId, intervalMs, onTick);
}

export function clearTypingTicker(roomId: string): void {
  const timer = tickers.get(roomId);
  if (timer) {
    clearInterval(timer);
    tickers.delete(roomId);
  }
}
