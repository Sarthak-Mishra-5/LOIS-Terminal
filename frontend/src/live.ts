// Merge the live snapshot into daily history so each chart's last point moves with the market.
import type { Bar, Point, Tile } from './api';

/** Replace the live day's point, or append it if it is newer than the history. */
export function mergeLivePoint(points: Point[], tile: Tile | null): Point[] {
  if (!tile?.liveDate || tile.value === null) return points;
  const last = points.at(-1);
  if (last && tile.liveDate < last.time) return points;
  const live = { time: tile.liveDate, value: tile.value };
  return last && last.time === tile.liveDate ? [...points.slice(0, -1), live] : [...points, live];
}

/** Update the live day's candle (close, widened high/low) or start a new one from the live quote. */
export function mergeLiveBar(bars: Bar[], tile: Tile | null): Bar[] {
  const live = tile?.bar;
  if (!tile?.liveDate || !live) return bars;
  const last = bars.at(-1);
  if (last && tile.liveDate < last.time) return bars;
  const base = last && last.time === tile.liveDate ? last : null;
  const open = live.open ?? base?.open ?? live.close;
  const prices = [live.high, live.low, base?.high, base?.low, open, live.close].filter(
    (p): p is number => typeof p === 'number' && Number.isFinite(p),
  );
  const bar: Bar = {
    time: tile.liveDate,
    open,
    high: Math.max(...prices),
    low: Math.min(...prices),
    close: live.close,
  };
  const volume = live.volume ?? base?.volume;
  if (volume !== null && volume !== undefined) bar.volume = volume;
  return base ? [...bars.slice(0, -1), bar] : [...bars, bar];
}
