import { ChartCard, StateText, Warn } from '../components/ChartCard';
import { POLL, usePoll, type LoisFix } from '../api';
import { fmtChange, fmtDay, fmtPrice, signClass } from '../format';

function Big({ label, value, sub, valueClass = '' }: { label: string; value: string; sub?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-[2px] border-r border-terminal-border px-3 py-2 last:border-r-0">
      <span className="label text-[9px] text-terminal-muted">{label}</span>
      <span className={`num text-[22px] font-bold leading-none ${valueClass}`}>{value}</span>
      <span className="num text-[10px] text-terminal-muted">{sub ?? ' '}</span>
    </div>
  );
}

/** EURIBOR fixing (~10:00 London) against the €STR OIS mid at 10:00, and how OIS has moved since. */
export function LoisFixPanel() {
  const { data, error, loading } = usePoll<LoisFix>('/api/lois/fix', POLL.fix);
  const three = data?.rows.find((r) => r.tenor === '3M');
  const vsFix = three?.loisNow != null && three?.loisAtFix != null ? three.loisNow - three.loisAtFix : null;

  return (
    <ChartCard
      title="SPOT LOIS AT EURIBOR FIX"
      subtitle={data?.fixDate ? `FIX ${fmtDay(data.fixDate)} · ${data.fixTimeLondon} LDN` : undefined}
      controls={data?.stale ? <Warn>Today's fix not out yet</Warn> : undefined}
    >
      {!data ? (
        <StateText loading={loading} error={error} />
      ) : (
        <div className="flex h-full flex-col">
          <div className="grid grid-cols-3 border-b border-terminal-border">
            <Big label="3M LOIS AT FIX" value={`${fmtPrice(three?.loisAtFix, 1)} bp`} sub={`FIX ${fmtPrice(three?.fixing, 3)} − OIS ${fmtPrice(three?.oisAtFix, 4)}`} />
            <Big
              label="3M OIS SINCE 10:00"
              value={`${fmtChange(three?.oisChangeBp, 1)} bp`}
              valueClass={signClass(three?.oisChangeBp)}
              sub={`OIS NOW ${fmtPrice(three?.oisNow, 4)}`}
            />
            <Big
              label="3M LOIS NOW"
              value={`${fmtPrice(three?.loisNow, 1)} bp`}
              sub={<span className={signClass(vsFix)}>{fmtChange(vsFix, 1)} bp VS FIX</span>}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="grid-table w-full">
              <thead>
                <tr>
                  <th>TENOR</th>
                  <th>FIXING %</th>
                  <th>OIS @10:00</th>
                  <th>LOIS @FIX</th>
                  <th>OIS NOW</th>
                  <th>ΔOIS bp</th>
                  <th>LOIS NOW</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.tenor}>
                    <td className="font-bold">{r.tenor}</td>
                    <td>{fmtPrice(r.fixing, 3)}</td>
                    <td>{fmtPrice(r.oisAtFix, 4)}</td>
                    <td className="font-bold">{fmtPrice(r.loisAtFix, 1)}</td>
                    <td>{fmtPrice(r.oisNow, 4)}</td>
                    <td className={signClass(r.oisChangeBp)}>{fmtChange(r.oisChangeBp, 1)}</td>
                    <td className="font-bold">{fmtPrice(r.loisNow, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-2 py-1 text-[10px] text-terminal-muted">
              LOIS @FIX = EURIBOR FIXING − €STR OIS 1-MIN MID AT 10:00 LDN · LOIS NOW USES THE LATEST MID
              {data.rows[0]?.oisAsOf ? ` (${data.rows[0].oisAsOf.slice(11, 16)} LDN)` : ''}
            </p>
            {error && <p className="px-2 text-[10px] text-terminal-down">REFRESH FAILED · {error}</p>}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
