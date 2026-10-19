export const DASH = '—';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Fixed decimals taken from the instrument's tick size. */
export function fmtPrice(v: number | null | undefined, decimals: number): string {
  return isNum(v) ? v.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : DASH;
}

/** Explicit sign: "+0.0125". */
export function fmtChange(v: number | null | undefined, decimals: number): string {
  if (!isNum(v)) return DASH;
  const body = fmtPrice(Math.abs(v), decimals);
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${body}`;
}

export function fmtZ(v: number | null | undefined): string {
  return fmtChange(v, 2);
}

/** 1.2k / 3.4M / 5.6B */
export function fmtVolume(v: number | null | undefined): string {
  if (!isNum(v)) return DASH;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return v.toFixed(0);
}

/** Text colour class for a signed number: green up, red down, muted otherwise. */
export function signClass(v: number | null | undefined): string {
  if (!isNum(v) || v === 0) return 'text-terminal-muted';
  return v > 0 ? 'text-terminal-up' : 'text-terminal-down';
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const shortDayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' });

export function fmtDay(iso: string | null | undefined, short = false): string {
  if (!iso) return DASH;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return (short ? shortDayFmt : dayFmt).format(date).toUpperCase();
}

const newsTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });
const newsDayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short' });
const londonDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' });

/** A headline's time in London: "09:42" today, "16 OCT" before. */
export function fmtNewsTime(iso: string): string {
  const date = new Date(iso);
  return londonDate.format(date) === londonDate.format(new Date())
    ? newsTimeFmt.format(date)
    : newsDayFmt.format(date).toUpperCase();
}

/** "MON 19 OCT 2026 09:42 LDN" */
export function fmtNewsStamp(iso: string): string {
  const date = new Date(iso);
  return `${fmtDay(londonDate.format(date))} ${newsTimeFmt.format(date)} LDN`;
}

const clockFmt = (zone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
export const utcClock = clockFmt('UTC');
export const londonClock = clockFmt('Europe/London');
