import { useMemo, useState } from 'react';
import { ChartCard, Segmented, StateText, Warn } from '../components/ChartCard';
import { LiquidityHeatmap } from '../charts/LiquidityHeatmap';
import { LineChart, type LineSeriesInput } from '../charts/LineChart';
import { POLL, usePoll, type Liquidity } from '../api';
import { fmtChange, fmtDay, fmtPrice, signClass } from '../format';
import { colors } from '../theme';

type Unit = 'bn' | 'tn';
const UNIT_OPTIONS = [{ label: 'EUR BN', value: 'bn' as Unit }, { label: 'EUR TN', value: 'tn' as Unit }];

/** The ECB publishes the previous business day at ~10:33 London; the backend re-checks every minute around it. */
function useLiquidity() {
  return usePoll<Liquidity>('/api/liquidity', POLL.liquidity);
}

export function LiquidityHeatmapPanel() {
  const { data, error, loading } = useLiquidity();
  const [unit, setUnit] = useState<Unit>('bn');
  const scaled = useMemo(
    () => (data ? data.heatmap.values.map((row) => row.map((v) => (v === null ? null : unit === 'bn' ? v : v / 1000))) : []),
    [data, unit],
  );
  return (
    <ChartCard
      title="MONTHLY LIQUIDITY HEATMAP"
      subtitle={data ? `EXCESS LIQUIDITY · MONTH-END CHANGE · ECB AS OF ${fmtDay(data.asOf)}` : undefined}
      controls={
        <>
          <Segmented options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
          <a className="ctl" href="/api/liquidity.csv" download>
            ↓ DAILY CSV
          </a>
        </>
      }
    >
      {data ? (
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">
            <LiquidityHeatmap
              years={data.heatmap.years}
              values={scaled}
              partial={data.heatmap.partial}
              unit={unit === 'bn' ? 'EUR bn' : 'EUR tn'}
              decimals={unit === 'bn' ? 1 : 3}
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-terminal-border px-2 py-1 text-[10px] text-terminal-muted">
            <span>
              LAST WEEKDAY OBS − PREVIOUS MONTH-END · * = PARTIAL MONTH · BEFORE {fmtDay(data.rebuiltBefore, true)} REBUILT
              FROM CURRENT ACCOUNTS + DF − MLF − RESERVE REQ.
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span>DRAIN</span>
              <span
                className="inline-block h-[6px] w-16 rounded-[2px]"
                style={{ background: `linear-gradient(to right, ${colors.heatDown}, ${colors.raised}, ${colors.heatUp})` }}
              />
              <span>ADDITION</span>
            </span>
          </div>
        </div>
      ) : (
        <StateText loading={loading} error={error} />
      )}
    </ChartCard>
  );
}

export function LiquidityDailyPanel() {
  const { data, error, loading } = useLiquidity();
  const publishWindow = data?.publishWindowLondon;
  return (
    <ChartCard
      title="DAILY EXCESS LIQUIDITY"
      subtitle="EUR bn · weekdays"
      controls={publishWindow ? <Warn>NEXT ECB UPDATE ~10:33 LDN</Warn> : undefined}
    >
      {!data ? (
        <StateText loading={loading} error={error} />
      ) : (
        <div className="h-full overflow-auto">
          <table className="grid-table w-full">
            <thead>
              <tr>
                <th>DATE</th>
                <th>EXCESS</th>
                <th>Δ D/D</th>
                <th>CUR ACC</th>
                <th>DEPOSIT</th>
                <th>MLF</th>
                <th>RES REQ</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((d) => (
                <tr key={d.date}>
                  <td>{fmtDay(d.date)}</td>
                  <td className="font-bold">{fmtPrice(d.excess_liquidity, 1)}</td>
                  <td className={signClass(d.daily_change)}>{fmtChange(d.daily_change, 1)}</td>
                  <td>{fmtPrice(d.current_accounts, 1)}</td>
                  <td>{fmtPrice(d.deposit_facility, 1)}</td>
                  <td>{fmtPrice(d.marginal_lending, 1)}</td>
                  <td>{fmtPrice(d.reserve_requirements, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

/** Excess liquidity level over time, from the same ECB daily data. */
export function LiquidityLinePanel() {
  const { data, error, loading } = useLiquidity();
  const series = useMemo<LineSeriesInput[]>(
    () =>
      data
        ? [{
            name: 'EXCESS LIQ',
            points: data.daily
              .filter((d) => d.excess_liquidity !== null)
              .map((d) => ({ time: d.date, value: d.excess_liquidity as number }))
              .reverse(),
          }]
        : [],
    [data],
  );
  return (
    <ChartCard title="EXCESS LIQUIDITY" subtitle="ECB · EUR bn">
      {data && <LineChart series={series} decimals={1} unit="bn" />}
      <StateText loading={loading && !data} error={!data ? error : null} />
    </ChartCard>
  );
}
