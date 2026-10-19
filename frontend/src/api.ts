import { createContext, useContext, useEffect, useRef, useState } from 'react';

// ── Response types (mirror backend/lois_api) ─────────────────────────────────

export interface Point { time: string; value: number }
export interface Bar { time: string; open: number; high: number; low: number; close: number; volume?: number }

export interface InstrumentMeta {
  key: string; label: string; ric: string | null; group: string; unit: string; decimals: number;
  kind: 'line' | 'ohlc' | 'derived'; note: string | null;
}
export interface LiveBar { open: number | null; high: number | null; low: number | null; close: number; volume: number | null }
/** `liveDate` is the trading day the live value belongs to on the daily charts; `bar` is today's OHLC so far. */
export interface Tile extends InstrumentMeta {
  value: number | null; change: number | null; liveDate?: string | null; bar?: LiveBar;
}
export interface Snapshot { asOf: string; groups: { title: string; tiles: Tile[] }[] }

export interface FixRow {
  tenor: string; fixing: number | null; oisAtFix: number | null; loisAtFix: number | null;
  oisNow: number | null; oisChangeBp: number | null; loisNow: number | null; oisAsOf: string | null;
}
export interface LoisFix { fixDate: string | null; fixTimeLondon: string; stale: boolean; rows: FixRow[] }

export interface LoisStat { tenor: string; latest: number; asOf: string; average: number; min: number; max: number; change1d: number | null }
export interface LoisHistory { unit: string; series: Record<string, Point[]>; stats: LoisStat[] }
export interface RatesHistory { euribor: Record<string, Point[]>; ois: Record<string, Point[]> }
export interface SeriesPayload extends InstrumentMeta { points: Point[] }
export interface OhlcPayload extends InstrumentMeta { bars: Bar[] }

export interface LiquidityDay {
  date: string; excess_liquidity: number | null; daily_change: number | null; current_accounts: number | null;
  deposit_facility: number | null; marginal_lending: number | null; reserve_requirements: number | null;
  net_autonomous_factors: number | null; open_market_operations: number | null;
}
export interface Liquidity {
  unit: string; asOf: string | null; latest: { value: number | null; change: number | null };
  heatmap: { years: number[]; values: (number | null)[][]; partial: boolean[][] };
  daily: LiquidityDay[]; rebuiltBefore: string; publishWindowLondon: [string, string];
}
export interface NewsTopic { key: string; label: string }
export interface Headline { id: string; time: string; headline: string; source: string }
export interface NewsPayload { query: string; items: Headline[] }
export interface Story { id: string; html: string }

export interface Status {
  serverTimeUtc: string;
  lseg: { connected: boolean; error: string | null; lastSuccessAgoSec: number | null };
  ecb: { ok: boolean | null; error: string | null };
}

// ── Fetching ─────────────────────────────────────────────────────────────────

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = String(body.detail);
    } catch { /* keep status text */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export interface Polled<T> { data: T | null; error: string | null; loading: boolean; updatedAt: number | null }

/**
 * Fetch `path` now and every `intervalMs` (0 = once). The last good data stays visible when a refresh fails,
 * so a dropped LSEG call never blanks a panel. Changing `path` (e.g. a new timeframe) refetches immediately.
 */
export function usePoll<T>(path: string | null, intervalMs: number): Polled<T> {
  const [state, setState] = useState<Polled<T>>({ data: null, error: null, loading: true, updatedAt: null });
  const pathRef = useRef(path);

  useEffect(() => {
    pathRef.current = path;
    if (!path) return;
    let controller = new AbortController();
    let timer: number | undefined;
    setState((s) => ({ ...s, loading: true }));

    const run = async () => {
      controller = new AbortController();
      try {
        const data = await getJson<T>(path, controller.signal);
        if (pathRef.current === path) setState({ data, error: null, loading: false, updatedAt: Date.now() });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (pathRef.current === path) setState((s) => ({ ...s, error: (err as Error).message, loading: false }));
      }
      if (intervalMs > 0) timer = window.setTimeout(run, intervalMs);
    };
    run();
    return () => {
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [path, intervalMs]);

  return state;
}

export const TIMEFRAMES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '5Y', days: 1825 },
  { label: 'MAX', days: 0 },
] as const;

// Refresh intervals in ms.
// Daily history is reloaded slowly; charts get their live last point from the shared snapshot instead.
export const POLL = {
  snapshot: 10_000, history: 900_000, stats: 60_000, fix: 60_000, liquidity: 60_000, status: 5_000, news: 30_000,
} as const;

// ── Shared live snapshot ─────────────────────────────────────────────────────

/** One snapshot poll for the whole page; the quote board and every chart read from it. */
export const LiveContext = createContext<Polled<Snapshot> | null>(null);

export function useLiveSnapshot(): Polled<Snapshot> {
  return usePoll<Snapshot>('/api/snapshot', POLL.snapshot);
}

export function useLiveTile(key: string): Tile | null {
  const live = useContext(LiveContext);
  for (const group of live?.data?.groups ?? []) {
    const tile = group.tiles.find((t) => t.key === key);
    if (tile) return tile;
  }
  return null;
}
