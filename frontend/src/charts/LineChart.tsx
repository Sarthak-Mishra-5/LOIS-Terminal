import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import { formatChartTime, lineStyle, lwcOptions, referenceLine, seriesColors } from '../theme';
import { fmtPrice } from '../format';
import { showLastDays } from './viewRange';
import type { Point } from '../api';

export interface LineSeriesInput {
  name: string;
  points: Point[];
  color?: string;
}

export interface ReferenceLevel {
  price: number;
  title: string;
}

const NO_LEVELS: ReferenceLevel[] = [];
const colorOf = (i: number, s: LineSeriesInput) => s.color ?? seriesColors[i % seriesColors.length];

/**
 * Multi-line time series (lightweight-charts). Hovered values show in a one-line readout above the plot;
 * with no hover the readout shows the latest values.
 *
 * Series are created once and updated in place, so live refreshes keep the user's zoom and scroll.
 * `rangeDays` sets the visible window (0 = all) when it or `resetKey` changes; older data stays scrollable.
 */
export function LineChart({
  series,
  decimals,
  unit = '',
  levels = NO_LEVELS,
  rangeDays = 0,
  resetKey = '',
}: {
  series: LineSeriesInput[];
  decimals: number;
  unit?: string;
  levels?: ReferenceLevel[];
  rangeDays?: number;
  resetKey?: string | number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const lines = useRef<ISeriesApi<'Line'>[]>([]);
  const priceLines = useRef<IPriceLine[]>([]);
  const applied = useRef<string | null>(null);
  const latest = useRef(series);
  latest.current = series;
  const [hover, setHover] = useState<{ time: Time; values: (number | null)[] } | null>(null);

  const names = series.map((s) => s.name).join('|');

  // Chart and series: rebuilt only when the set of series or the precision changes.
  useEffect(() => {
    if (!container.current) return;
    const api = createChart(container.current, lwcOptions());
    chart.current = api;
    lines.current = latest.current.map((s, i) =>
      api.addLineSeries({
        ...lineStyle,
        color: colorOf(i, s),
        title: latest.current.length > 1 ? s.name : '',
        priceFormat: { type: 'price', precision: decimals, minMove: 10 ** -decimals },
      }),
    );
    applied.current = null;
    const onMove = (param: MouseEventParams) => {
      if (!param.time || !param.point) return setHover(null);
      setHover({
        time: param.time,
        values: lines.current.map((line) => (param.seriesData.get(line) as LineData | undefined)?.value ?? null),
      });
    };
    api.subscribeCrosshairMove(onMove);
    return () => {
      api.unsubscribeCrosshairMove(onMove);
      api.remove();
      chart.current = null;
      lines.current = [];
      priceLines.current = [];
    };
  }, [names, decimals]);

  // Data: pushed into the existing series on every refresh.
  useEffect(() => {
    const api = chart.current;
    if (!api) return;
    series.forEach((s, i) => lines.current[i]?.setData(s.points.map((p) => ({ time: p.time as Time, value: p.value }))));
    const view = `${resetKey}|${rangeDays}`;
    const lastTime = series[0]?.points.at(-1)?.time;
    if (applied.current !== view && lastTime) {
      showLastDays(api, lastTime, rangeDays);
      applied.current = view;
    }
  }, [series, rangeDays, resetKey, names, decimals]);

  // Reference levels on the first series.
  useEffect(() => {
    const first = lines.current[0];
    if (!first) return;
    priceLines.current.forEach((line) => first.removePriceLine(line));
    priceLines.current = levels.map((level) => first.createPriceLine({ ...referenceLine, price: level.price, title: level.title }));
  }, [levels, names, decimals]);

  const time = hover?.time ?? (series[0]?.points.at(-1)?.time as Time | undefined) ?? null;
  const values = hover?.values ?? series.map((s) => s.points.at(-1)?.value ?? null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-x-3 px-2 py-[3px] text-[10px] num border-b border-terminal-border">
        <span className="text-terminal-muted">{time ? formatChartTime(time).toUpperCase() : '—'}</span>
        {series.map((s, i) => (
          <span key={s.name} style={{ color: colorOf(i, s) }}>
            {series.length > 1 ? `${s.name} ` : ''}
            {fmtPrice(values[i], decimals)}
            {unit ? ` ${unit}` : ''}
          </span>
        ))}
      </div>
      <div ref={container} className="flex-1 min-h-0" />
    </div>
  );
}
