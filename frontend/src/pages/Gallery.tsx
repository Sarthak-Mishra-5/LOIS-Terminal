import { useMemo, useState } from 'react';
import { ChartCard, Segmented, StateText } from '../components/ChartCard';
import { LineChart } from '../charts/LineChart';
import { CandleChart } from '../charts/CandleChart';
import { LiquidityHeatmap } from '../charts/LiquidityHeatmap';
import { PlotlyChart } from '../charts/PlotlyChart';
import type { Bar, Point } from '../api';
import { colors } from '../theme';

// Deterministic sample data so the gallery renders without the API.
function walk(n: number, start: number, step: number, seed: number): number[] {
  let x = seed;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280) - 0.5;
  const out = [start];
  for (let i = 1; i < n; i++) out.push(out[i - 1] + rand() * step);
  return out;
}
function days(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2026, 0, 2));
  while (out.length < n) {
    if (d.getUTCDay() % 6 !== 0) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const DATES = days(120);
const LINES = ['3M', '6M', '12M'].map((name, i) => ({
  name,
  points: walk(120, 10 + i * 9, 1.6, 7 + i).map((value, j): Point => ({ time: DATES[j], value })),
}));
const BARS: Bar[] = (() => {
  const closes = walk(120, 290, 6, 3);
  return closes.map((close, i) => {
    const open = i ? closes[i - 1] : close;
    return { time: DATES[i], open, close, high: Math.max(open, close) + 2, low: Math.min(open, close) - 2, volume: 2e8 + (i % 7) * 3e7 };
  });
})();
const HEAT_YEARS = [2024, 2025, 2026];
const HEAT_VALUES = [
  [141.4, -28.6, -241.3, -9.3, -47.8, -85.4, -33.5, 1.5, -71.7, -46.5, -30.8, -67.1],
  [42.0, -57.2, -21.4, -54.0, -34.1, -31.2, -62.9, 47.6, -46.8, -113.9, -29.4, -34.3],
  [17.0, -45.9, -56.2, -92.6, -55.1, -19.6, -31.1, -6.1, -33.0, -3.3, null, null],
];
const HEAT_PARTIAL = HEAT_VALUES.map((row, r) => row.map((_, c) => r === 2 && c === 9));

/** One of each chart type side by side, to check that colours, fonts and borders match. */
export function Gallery() {
  const [tf, setTf] = useState(365);
  const tfControls = (
    <Segmented options={[{ label: '3M', value: 90 }, { label: '1Y', value: 365 }, { label: 'MAX', value: 0 }]} value={tf} onChange={setTf} />
  );
  const barData = useMemo(
    () => [{
      type: 'bar',
      x: ['OCT6', 'DEC6', 'MAR7', 'JUN7', 'SEP7', 'DEC7'],
      y: [12.0, 18.5, 20.5, 21.2, 21.0, 20.5],
      marker: { color: colors.info },
      hovertemplate: '%{x}: %{y:.1f} bp<extra></extra>',
    } as Plotly.Data],
    [],
  );
  return (
    <main className="grid gap-[6px] p-[6px] md:grid-cols-2 xl:grid-cols-3" style={{ gridAutoRows: '300px' }}>
      <ChartCard title="LIGHTWEIGHT · MULTI-LINE" subtitle="sample LOIS, bp" controls={tfControls}>
        <LineChart series={LINES} decimals={1} unit="bp" />
      </ChartCard>
      <ChartCard title="LIGHTWEIGHT · LINE + LEVEL" subtitle="sample, reference level" controls={tfControls}>
        <LineChart series={[LINES[0]]} decimals={1} unit="bp" levels={[{ price: 10, title: 'REF' }]} />
      </ChartCard>
      <ChartCard title="LIGHTWEIGHT · CANDLES + VOLUME" subtitle="sample index" controls={tfControls}>
        <CandleChart bars={BARS} decimals={2} />
      </ChartCard>
      <ChartCard title="PLOTLY · HEATMAP" subtitle="excess liquidity, EUR bn">
        <LiquidityHeatmap years={HEAT_YEARS} values={HEAT_VALUES} partial={HEAT_PARTIAL} unit="EUR bn" decimals={1} />
      </ChartCard>
      <ChartCard title="PLOTLY · BAR" subtitle="sample strip, bp">
        <PlotlyChart data={barData} layout={{ margin: { l: 40, r: 10, t: 10, b: 30 } }} />
      </ChartCard>
      <ChartCard title="STATES" subtitle="loading / error / empty">
        <div className="grid h-full grid-cols-3">
          <div className="relative border-r border-terminal-border"><StateText loading /></div>
          <div className="relative border-r border-terminal-border"><StateText error="LSEG: User has no permission" /></div>
          <div className="relative"><StateText empty /></div>
        </div>
      </ChartCard>
    </main>
  );
}
