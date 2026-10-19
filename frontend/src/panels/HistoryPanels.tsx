import { useMemo, useState } from 'react';
import { ChartCard, Segmented, StateText } from '../components/ChartCard';
import { LineChart, type LineSeriesInput } from '../charts/LineChart';
import { CandleChart } from '../charts/CandleChart';
import {
  POLL, TIMEFRAMES, useLiveTile, usePoll, type LoisHistory, type OhlcPayload, type RatesHistory, type SeriesPayload,
  type Tile,
} from '../api';
import { mergeLiveBar, mergeLivePoint } from '../live';
import { fmtChange, fmtPrice, signClass } from '../format';

// Charts load their full daily history once; these buttons only choose the visible window.
const TF_OPTIONS = TIMEFRAMES.map((t) => ({ label: t.label, value: t.days }));
const SHORT_TF = TF_OPTIONS.filter((t) => [90, 365, 1825, 0].includes(t.value));
const CANDLE_TF = TF_OPTIONS.filter((t) => [90, 180, 365, 1825, 0].includes(t.value));
const STATS_TF = TF_OPTIONS.filter((t) => [90, 365, 1825].includes(t.value));
const TENORS = ['3M', '6M', '12M'];

/** Visible window in days, plus a click counter so re-clicking the active timeframe resets a zoomed chart. */
function useView(initial: number) {
  const [view, setView] = useState({ days: initial, clicks: 0 });
  return { days: view.days, reset: view.clicks, set: (days: number) => setView((v) => ({ days, clicks: v.clicks + 1 })) };
}

function useTenorTiles(prefix: string): (Tile | null)[] {
  return [useLiveTile(`${prefix}_3m`), useLiveTile(`${prefix}_6m`), useLiveTile(`${prefix}_12m`)];
}

/** Spot LOIS (EURIBOR fixing − €STR OIS) for all three tenors; one year visible by default. */
export function LoisHistoryPanel() {
  const view = useView(365);
  const { data, error, loading } = usePoll<LoisHistory>('/api/lois/history?days=0', POLL.history);
  const [l3, l6, l12] = useTenorTiles('lois');
  const series = useMemo<LineSeriesInput[]>(
    () => (data ? TENORS.map((t, i) => ({ name: t, points: mergeLivePoint(data.series[t] ?? [], [l3, l6, l12][i]) })) : []),
    [data, l3, l6, l12],
  );
  return (
    <ChartCard
      title="SPOT LOIS · EURIBOR − €STR OIS"
      subtitle="bp · daily close + live"
      controls={<Segmented options={TF_OPTIONS} value={view.days} onChange={view.set} />}
    >
      {data && <LineChart series={series} decimals={1} unit="bp" rangeDays={view.days} resetKey={view.reset} />}
      <StateText loading={loading && !data} error={!data ? error : null} empty={data?.stats.length === 0} />
    </ChartCard>
  );
}

/** Summary statistics for the selected LOIS window (computed server-side for that window). */
export function LoisStatsPanel() {
  const [days, setDays] = useState(365);
  const { data, error, loading } = usePoll<LoisHistory>(`/api/lois/history?days=${days}`, POLL.stats);
  return (
    <ChartCard title="LOIS STATS" subtitle="bp" controls={<Segmented options={STATS_TF} value={days} onChange={setDays} />}>
      {!data ? (
        <StateText loading={loading} error={error} />
      ) : (
        <table className="grid-table w-full">
          <thead>
            <tr>
              <th>TENOR</th>
              <th>LAST</th>
              <th>1D</th>
              <th>AVG</th>
              <th>MIN</th>
              <th>MAX</th>
            </tr>
          </thead>
          <tbody>
            {data.stats.map((s) => (
              <tr key={s.tenor}>
                <td className="font-bold">{s.tenor}</td>
                <td className="font-bold">{fmtPrice(s.latest, 1)}</td>
                <td className={signClass(s.change1d)}>{fmtChange(s.change1d, 1)}</td>
                <td>{fmtPrice(s.average, 1)}</td>
                <td>{fmtPrice(s.min, 1)}</td>
                <td>{fmtPrice(s.max, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartCard>
  );
}

/** EURIBOR fixings or €STR OIS by tenor, switchable. */
export function RatesPanel() {
  const view = useView(365);
  const [curve, setCurve] = useState<'euribor' | 'ois'>('euribor');
  const { data, error, loading } = usePoll<RatesHistory>('/api/rates/history?days=0', POLL.history);
  const [e3, e6, e12] = useTenorTiles('euribor');
  const [o3, o6, o12] = useTenorTiles('ois');
  const series = useMemo<LineSeriesInput[]>(() => {
    if (!data) return [];
    const live = curve === 'euribor' ? [e3, e6, e12] : [o3, o6, o12];
    return TENORS.map((t, i) => ({ name: t, points: mergeLivePoint(data[curve][t] ?? [], live[i]) }));
  }, [data, curve, e3, e6, e12, o3, o6, o12]);
  return (
    <ChartCard
      title={curve === 'euribor' ? 'EURIBOR FIXINGS' : '€STR OIS (MID)'}
      subtitle="%"
      controls={
        <>
          <Segmented
            options={[{ label: 'EURIBOR', value: 'euribor' as const }, { label: 'OIS', value: 'ois' as const }]}
            value={curve}
            onChange={setCurve}
          />
          <span className="w-2" />
          <Segmented options={SHORT_TF} value={view.days} onChange={view.set} />
        </>
      }
    >
      {data && (
        <LineChart
          series={series}
          decimals={curve === 'euribor' ? 3 : 4}
          unit="%"
          rangeDays={view.days}
          resetKey={`${curve}-${view.reset}`}
        />
      )}
      <StateText loading={loading && !data} error={!data ? error : null} />
    </ChartCard>
  );
}

/** One instrument's daily line, for instruments without open/high/low history (the cross-currency swap). */
export function SeriesPanel({ instrument }: { instrument: string }) {
  const view = useView(365);
  const { data, error, loading } = usePoll<SeriesPayload>(`/api/series/${instrument}?days=0`, POLL.history);
  const live = useLiveTile(instrument);
  const series = useMemo<LineSeriesInput[]>(
    () => (data ? [{ name: data.label, points: mergeLivePoint(data.points, live) }] : []),
    [data, live],
  );
  return (
    <ChartCard
      title={data?.label ?? instrument.toUpperCase()}
      subtitle={data ? `${data.ric}${data.unit ? ` · ${data.unit}` : ''}` : undefined}
      controls={<Segmented options={SHORT_TF} value={view.days} onChange={view.set} />}
    >
      {data && (
        <LineChart series={series} decimals={data.decimals} unit={data.unit} rangeDays={view.days} resetKey={view.reset} />
      )}
      <StateText loading={loading && !data} error={!data ? error : null} empty={data?.points.length === 0} />
    </ChartCard>
  );
}

/** Daily candles (with volume when there is any) for an index, future, spread, FX rate or CDS; six months visible by default. */
export function CandlePanel({ instrument }: { instrument: string }) {
  const view = useView(180);
  const { data, error, loading } = usePoll<OhlcPayload>(`/api/ohlc/${instrument}?days=0`, POLL.history);
  const live = useLiveTile(instrument);
  const bars = useMemo(() => (data ? mergeLiveBar(data.bars, live) : []), [data, live]);
  return (
    <ChartCard
      title={data?.label ?? instrument.toUpperCase()}
      subtitle={data ? `${data.ric}${data.unit ? ` · ${data.unit}` : ''}` : undefined}
      controls={
        <>
          {data?.note && (
            <span className="text-[9px] font-bold uppercase text-terminal-warn" title={data.note}>
              PROXY
            </span>
          )}
          <Segmented options={CANDLE_TF} value={view.days} onChange={view.set} />
        </>
      }
    >
      {data && <CandleChart bars={bars} decimals={data.decimals} rangeDays={view.days} resetKey={view.reset} />}
      <StateText loading={loading && !data} error={!data ? error : null} empty={data?.bars.length === 0} />
    </ChartCard>
  );
}
