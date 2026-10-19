import type { IChartApi, Time } from 'lightweight-charts';

const DAY_MS = 86_400_000;

/**
 * Show the last `days` calendar days of a daily chart (0 = everything). All history stays loaded,
 * so the user can still scroll or zoom out past this window.
 */
export function showLastDays(api: IChartApi, lastTime: string, days: number): void {
  // Wait a frame so an auto-sized chart has its width before the range is applied.
  requestAnimationFrame(() => {
    if (days <= 0) {
      api.timeScale().fitContent();
      return;
    }
    const to = new Date(`${lastTime}T00:00:00Z`).getTime();
    const from = new Date(to - days * DAY_MS).toISOString().slice(0, 10);
    try {
      api.timeScale().setVisibleRange({ from: from as Time, to: lastTime as Time });
    } catch {
      api.timeScale().fitContent();
    }
  });
}
