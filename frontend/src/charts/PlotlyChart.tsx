import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { darkConfig, darkLayout } from '../theme';

/** Thin Plotly wrapper: every chart spreads the shared dark layout and config, then overrides what it needs. */
export function PlotlyChart({ data, layout = {} }: { data: Plotly.Data[]; layout?: Partial<Plotly.Layout> }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    Plotly.react(el, data, { ...darkLayout, ...layout, autosize: true } as Partial<Plotly.Layout>, darkConfig);
  }, [data, layout]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(() => Plotly.Plots.resize(el));
    observer.observe(el);
    return () => {
      observer.disconnect();
      Plotly.purge(el);
    };
  }, []);

  return <div ref={container} className="h-full w-full" style={{ background: darkLayout.paper_bgcolor }} />;
}
