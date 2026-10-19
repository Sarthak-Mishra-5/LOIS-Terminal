import { LiveContext, useLiveSnapshot } from '../api';
import { LoisFixPanel } from '../panels/LoisFixPanel';
import { NewsPanels } from '../panels/NewsPanels';
import { QuoteBoard } from '../panels/QuoteBoard';
import { CandlePanel, LoisHistoryPanel, LoisStatsPanel, RatesPanel, SeriesPanel } from '../panels/HistoryPanels';
import { LiquidityDailyPanel, LiquidityHeatmapPanel, LiquidityLinePanel } from '../panels/LiquidityPanels';

const SPREAD_FX_INSTRUMENTS = ['oat_bund', 'btp_bund', 'eurchf', 'xccy_3m', 'fr_cds_5y'];
// The cross-currency swap has no open/high/low history, so it stays a line.
const LINE_INSTRUMENTS = ['xccy_3m'];
const CANDLE_INSTRUMENTS = ['sx7e', 'sx7p', 'sx8p', 'es', 'nq', 'brent', 'ttf'];

/** Dense grid of panels. Rows have fixed heights so charts get room; the page scrolls only past the first screen. */
export function Dashboard() {
  const live = useLiveSnapshot();
  return (
    <LiveContext.Provider value={live}>
    <main className="flex flex-col gap-[6px] p-[6px]">
      <div className="grid gap-[6px] lg:grid-cols-12" style={{ gridAutoRows: 'minmax(0, auto)' }}>
        <div className="h-[205px] lg:col-span-5">
          <LoisFixPanel />
        </div>
        <div className="h-[205px] lg:col-span-7">
          <QuoteBoard />
        </div>
      </div>

      <div className="grid gap-[6px] lg:grid-cols-12">
        <NewsPanels />
      </div>

      <div className="grid gap-[6px] sm:grid-cols-2 lg:grid-cols-5">
        {SPREAD_FX_INSTRUMENTS.map((key) => (
          <div key={key} className="h-[260px]">
            {LINE_INSTRUMENTS.includes(key) ? <SeriesPanel instrument={key} /> : <CandlePanel instrument={key} />}
          </div>
        ))}
      </div>

      <div className="grid gap-[6px] sm:grid-cols-2 lg:grid-cols-4">
        {CANDLE_INSTRUMENTS.map((key) => (
          <div key={key} className="h-[260px]">
            <CandlePanel instrument={key} />
          </div>
        ))}
      </div>

      <div className="grid gap-[6px] lg:grid-cols-12">
        <div className="h-[340px] lg:col-span-6">
          <LoisHistoryPanel />
        </div>
        <div className="h-[340px] lg:col-span-4">
          <RatesPanel />
        </div>
        <div className="flex h-[340px] flex-col gap-[6px] lg:col-span-2">
          <div className="h-[140px]">
            <LoisStatsPanel />
          </div>
          <div className="min-h-0 flex-1">
            <LiquidityLinePanel />
          </div>
        </div>
      </div>

      <div className="grid gap-[6px] lg:grid-cols-12">
        <div className="h-[420px] lg:col-span-7">
          <LiquidityHeatmapPanel />
        </div>
        <div className="h-[420px] lg:col-span-5">
          <LiquidityDailyPanel />
        </div>
      </div>
    </main>
    </LiveContext.Provider>
  );
}
