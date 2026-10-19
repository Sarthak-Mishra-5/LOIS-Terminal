import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import { candleStyle, formatChartTime, lwcOptions, timeKey, volumeColors } from '../theme';
import { fmtChange, fmtPrice, fmtVolume, signClass } from '../format';
import type { Bar } from '../api';
import { showLastDays } from './viewRange';

/**
 * Daily candles, with volume (when the bars have it) in the bottom ~18% of the pane on its own hidden scale.
 * Data refreshes update the series in place (zoom and scroll are kept). `rangeDays` sets the visible window
 * (0 = all) when it changes; older bars stay loaded and scrollable.
 */
export function CandleChart({
  bars,
  decimals,
  rangeDays = 0,
  resetKey = '',
}: {
  bars: Bar[];
  decimals: number;
  rangeDays?: number;
  resetKey?: string | number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volume = useRef<ISeriesApi<'Histogram'> | null>(null);
  const applied = useRef<string | null>(null);
  const byTime = useRef(new Map<string, Bar>());
  const [hover, setHover] = useState<Bar | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const api = createChart(container.current, lwcOptions());
    const c = api.addCandlestickSeries({
      ...candleStyle,
      priceFormat: { type: 'price', precision: decimals, minMove: 10 ** -decimals },
    });
    c.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.2 } });
    const v = api.addHistogramSeries({
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    api.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    const onMove = (param: MouseEventParams) => {
      if (!param.time || !param.point) return setHover(null);
      const candle = param.seriesData.get(c) as CandlestickData | undefined;
      if (!candle) return setHover(null);
      const key = timeKey(param.time);
      const vol = param.seriesData.get(v) as HistogramData | undefined;
      setHover({ ...byTime.current.get(key), ...candle, time: key, volume: vol?.value } as Bar);
    };
    api.subscribeCrosshairMove(onMove);
    chart.current = api;
    candles.current = c;
    volume.current = v;
    applied.current = null;
    return () => {
      api.unsubscribeCrosshairMove(onMove);
      api.remove();
      chart.current = null;
    };
  }, [decimals]);

  useEffect(() => {
    const api = chart.current;
    if (!api || !candles.current || !volume.current) return;
    byTime.current = new Map(bars.map((b) => [b.time, b]));
    candles.current.setData(bars.map((b) => ({ ...b, time: b.time as Time })));
    // Without volume, the candles take the space kept for the volume pane.
    const hasVolume = bars.some((b) => b.volume !== undefined);
    candles.current.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: hasVolume ? 0.2 : 0.06 } });
    volume.current.setData(
      bars
        .filter((b) => b.volume !== undefined)
        .map((b) => ({ time: b.time as Time, value: b.volume!, color: b.close >= b.open ? volumeColors.up : volumeColors.down })),
    );
    const view = `${resetKey}|${rangeDays}`;
    if (applied.current !== view && bars.length) {
      showLastDays(api, bars[bars.length - 1].time, rangeDays);
      applied.current = view;
    }
  }, [bars, decimals, rangeDays, resetKey]);

  const shown = hover ?? bars.at(-1) ?? null;
  const index = shown ? bars.findIndex((b) => b.time === shown.time) : -1;
  const prevClose = index > 0 ? bars[index - 1].close : null;
  const change = shown && prevClose !== null ? shown.close - prevClose : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-x-2 px-2 py-[3px] text-[10px] num border-b border-terminal-border">
        <span className="text-terminal-muted">{shown ? formatChartTime(shown.time as Time).toUpperCase() : '—'}</span>
        <span>O {fmtPrice(shown?.open, decimals)}</span>
        <span>H {fmtPrice(shown?.high, decimals)}</span>
        <span>L {fmtPrice(shown?.low, decimals)}</span>
        <span>C {fmtPrice(shown?.close, decimals)}</span>
        <span className={signClass(change)}>{fmtChange(change, decimals)}</span>
        {shown?.volume !== undefined && <span className="text-terminal-muted">V {fmtVolume(shown.volume)}</span>}
      </div>
      <div ref={container} className="flex-1 min-h-0" />
    </div>
  );
}
