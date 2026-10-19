// The one place chart and UI colours are defined. Charts import from here; never hard-code hex values elsewhere.
// tailwind.config.js mirrors these values as the `terminal` colour set for class names.
import {
  ColorType,
  CrosshairMode,
  type DeepPartial,
  type ChartOptions,
  type Time,
} from 'lightweight-charts';

export const colors = {
  bg: '#0a0a0a',
  panel: '#141414',
  raised: '#1a1a1a',
  border: '#262626',
  gridFaint: '#1c1c1c',
  scaleBorder: '#2a2a2a',
  active: '#2a2a2a',
  activeBorder: '#3a3a3a',
  axis: '#404040',
  text: '#e5e5e5',
  chartText: '#d1d4dc',
  muted: '#666666',
  // Direction / status only.
  up: '#00ff88',
  down: '#ff3355',
  candleUp: '#26a69a',
  candleDown: '#ef5350',
  // Attention and reference.
  warn: '#ffaa00',
  info: '#4aa8ff',
  level: '#2962ff',
  // Heatmap end points: the largest addition is a slightly dark green, the largest drain red.
  heatUp: '#2e7d32',
  heatDown: '#ef5350',
} as const;

// Series colours for multi-line charts: distinct from the up/down colours, at most three.
export const seriesColors = [colors.info, '#c792ea', '#e5e5e5'] as const;

export const font = {
  family: "'JetBrains Mono', 'Fira Code', Consolas, Menlo, monospace",
  chartSize: 10,
  plotlySize: 11,
} as const;

export const withAlpha = (hex: string, alpha: number): string => {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

// ── lightweight-charts ───────────────────────────────────────────────────────

const MARKET_ZONE = 'Europe/London';
const tickDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' });
const tickMonth = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', year: '2-digit' });
const tickYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', year: 'numeric' });
const tickTime = new Intl.DateTimeFormat('en-GB', { timeZone: MARKET_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
const fullDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const fullDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: MARKET_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** Daily bars arrive as 'YYYY-MM-DD' (a business day); intraday bars as UTC seconds. */
export function timeToDate(time: Time): { date: Date; intraday: boolean } {
  if (typeof time === 'number') return { date: new Date(time * 1000), intraday: true };
  if (typeof time === 'string') return { date: new Date(`${time}T00:00:00Z`), intraday: false };
  return { date: new Date(Date.UTC(time.year, time.month - 1, time.day)), intraday: false };
}

/** Stable key for a chart time: 'YYYY-MM-DD' for daily bars, seconds for intraday. */
export function timeKey(time: Time): string {
  if (typeof time === 'number' || typeof time === 'string') return String(time);
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
}

export function formatChartTime(time: Time): string {
  const { date, intraday } = timeToDate(time);
  return intraday ? `${fullDateTime.format(date)} LDN` : fullDate.format(date);
}

// TickMarkType: 0 Year, 1 Month, 2 DayOfMonth, 3 Time, 4 TimeWithSeconds.
function tickMarkFormatter(time: Time, tickMarkType: number): string {
  const { date } = timeToDate(time);
  if (tickMarkType === 0) return tickYear.format(date);
  if (tickMarkType === 1) return tickMonth.format(date);
  if (tickMarkType >= 3) return tickTime.format(date);
  return tickDate.format(date);
}

export function lwcOptions(): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: colors.bg },
      textColor: colors.chartText,
      fontSize: font.chartSize,
      fontFamily: font.family,
      attributionLogo: false,
    },
    grid: { vertLines: { color: colors.gridFaint }, horzLines: { color: colors.gridFaint } },
    rightPriceScale: { borderColor: colors.scaleBorder },
    timeScale: { borderColor: colors.scaleBorder, timeVisible: true, secondsVisible: false, tickMarkFormatter },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: colors.axis, labelBackgroundColor: colors.raised },
      horzLine: { color: colors.axis, labelBackgroundColor: colors.raised },
    },
    localization: { timeFormatter: formatChartTime },
  };
}

export const candleStyle = {
  upColor: colors.candleUp,
  downColor: colors.candleDown,
  borderUpColor: colors.candleUp,
  borderDownColor: colors.candleDown,
  wickUpColor: colors.candleUp,
  wickDownColor: colors.candleDown,
  priceLineVisible: false,
} as const;

export const volumeColors = { up: withAlpha(colors.candleUp, 0.5), down: withAlpha(colors.candleDown, 0.5) };

export const lineStyle = { lineWidth: 2 as const, priceLineVisible: false };

export const referenceLine = { color: colors.level, lineWidth: 1 as const, axisLabelVisible: true };

// ── Plotly ───────────────────────────────────────────────────────────────────

const plotlyAxis = { gridcolor: colors.border, zerolinecolor: colors.axis, linecolor: colors.axis, tickcolor: colors.axis };

export const darkLayout = {
  paper_bgcolor: colors.bg,
  plot_bgcolor: colors.bg,
  font: { family: font.family, color: colors.text, size: font.plotlySize },
  margin: { l: 50, r: 20, t: 30, b: 40 },
  xaxis: plotlyAxis,
  yaxis: plotlyAxis,
  legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: colors.text } },
  hoverlabel: { bgcolor: colors.panel, bordercolor: colors.axis, font: { color: colors.text, family: font.family } },
};

export const darkConfig = { displayModeBar: false, responsive: true };

// Diverging scale for normalised values in [-1, 1]: red drain → dark neutral → slightly dark green addition.
export const heatScale: [number, string][] = [
  [0, colors.heatDown],
  [0.3, withAlpha(colors.heatDown, 0.7)],
  [0.49, withAlpha(colors.heatDown, 0.25)],
  [0.5, colors.raised],
  [0.51, withAlpha(colors.heatUp, 0.3)],
  [0.7, withAlpha(colors.heatUp, 0.7)],
  [1, colors.heatUp],
];
