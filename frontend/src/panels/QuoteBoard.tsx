import { useContext, useEffect, useRef, useState } from 'react';
import { ChartCard, StateText } from '../components/ChartCard';
import { LiveContext, POLL, usePoll, type Liquidity, type Tile } from '../api';
import { fmtChange, fmtDay, fmtPrice, signClass } from '../format';

/** Briefly highlights a value cell in amber when it changes. */
function useFlash(value: number | null): boolean {
  const previous = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (previous.current !== null && value !== null && previous.current !== value) {
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 600);
      previous.current = value;
      return () => window.clearTimeout(id);
    }
    previous.current = value;
  }, [value]);
  return flash;
}

function QuoteRow({ tile }: { tile: Tile }) {
  const flash = useFlash(tile.value);
  return (
    <tr title={[tile.ric, tile.note].filter(Boolean).join(' · ')}>
      <td>{tile.label}</td>
      <td className={`font-bold ${flash ? 'text-terminal-warn' : ''}`}>{fmtPrice(tile.value, tile.decimals)}</td>
      <td className={signClass(tile.change)}>{fmtChange(tile.change, tile.decimals)}</td>
      <td className="text-terminal-muted">{tile.unit}</td>
    </tr>
  );
}

function Group({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <table className="grid-table w-full">
      <thead>
        <tr>
          <th className="text-terminal-text">{title}</th>
          <th>LAST</th>
          <th>CHG</th>
          <th>UNIT</th>
        </tr>
      </thead>
      <tbody>
        {tiles.map((tile) => (
          <QuoteRow key={tile.key} tile={tile} />
        ))}
      </tbody>
    </table>
  );
}

// LOIS, fixings and OIS have their own panels, so the board leaves them out.
const HIDDEN_GROUPS = ['SPOT LOIS', 'EURIBOR FIXINGS', '€STR OIS'];
const COMPACT_GROUPS = ['ENERGY'];

/** Every live quote, grouped, in a dense board that flows into as many columns as fit. */
export function QuoteBoard() {
  const live = useContext(LiveContext);
  const { data, error, loading, updatedAt } = live ?? { data: null, error: null, loading: true, updatedAt: null };
  const liquidity = usePoll<Liquidity>('/api/liquidity', POLL.liquidity);

  const groups = (data?.groups ?? []).filter((g) => !HIDDEN_GROUPS.includes(g.title));
  const liq = liquidity.data;
  const liquidityTile: Tile | null = liq
    ? {
        key: 'excess_liquidity', label: `EXCESS LIQ ${fmtDay(liq.asOf, true)}`, ric: null, group: 'ECB', unit: 'EUR bn',
        decimals: 1, kind: 'derived', note: 'ECB Data Portal, previous business day', value: liq.latest.value,
        change: liq.latest.change,
      }
    : null;
  // Columns size to their content: ECB liquidity stacks under energy, and that short column only takes a small
  // share of the spare width so the long equity and spread names stay readable.
  const ecb = liquidityTile ? [{ title: 'ECB LIQUIDITY', tiles: [liquidityTile] }] : [];
  const energyAt = groups.findIndex((g) => g.title === 'ENERGY');
  const stackAt = energyAt >= 0 ? energyAt : groups.length - 1;
  const columns = groups.map((g, i) => (i === stackAt ? [g, ...ecb] : [g]));
  if (!groups.length) columns.push(ecb);

  return (
    <ChartCard
      title="LIVE QUOTES"
      subtitle={updatedAt ? `UPDATED ${new Date(updatedAt).toLocaleTimeString('en-GB', { hour12: false })}` : undefined}
      controls={error && data ? <span className="text-[10px] text-terminal-down">REFRESH FAILED</span> : undefined}
    >
      {!data ? (
        <StateText loading={loading} error={error} />
      ) : (
        <div className="h-full overflow-auto">
          <div className="flex flex-wrap items-start gap-x-[6px]">
            {columns.map((column) => (
              <div
                key={column[0]?.title ?? 'ecb'}
                className="min-w-0"
                style={{ flex: `${COMPACT_GROUPS.includes(column[0]?.title) ? 0.3 : 1} 1 max-content` }}
              >
                {column.map((g) => (
                  <Group key={g.title} title={g.title} tiles={g.tiles} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
