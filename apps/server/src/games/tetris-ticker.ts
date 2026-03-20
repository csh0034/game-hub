const tickers = new Map<string, ReturnType<typeof setInterval>>();

export function startTetrisTicker(roomId: string, intervalMs: number, onTick: () => void): void {
  clearTetrisTicker(roomId);
  const timer = setInterval(onTick, intervalMs);
  tickers.set(roomId, timer);
}

export function updateTetrisTickerInterval(roomId: string, intervalMs: number, onTick: () => void): void {
  if (!tickers.has(roomId)) return;
  startTetrisTicker(roomId, intervalMs, onTick);
}

export function clearTetrisTicker(roomId: string): void {
  const timer = tickers.get(roomId);
  if (timer) {
    clearInterval(timer);
    tickers.delete(roomId);
  }
}
