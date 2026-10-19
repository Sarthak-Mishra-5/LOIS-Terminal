import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyChart';
import { colors, font, heatScale } from '../theme';
import { fmtChange } from '../format';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Year × month heatmap of month-on-month changes. Additions and drains are scaled separately, so the largest
 * addition is the full green and the largest drain the full red, and each cell's shade is relative to those.
 */
export function LiquidityHeatmap({
  years,
  values,
  partial,
  unit,
  decimals,
}: {
  years: number[];
  values: (number | null)[][];
  partial: boolean[][];
  unit: string;
  decimals: number;
}) {
  const { data, layout } = useMemo(() => {
    const flat = values.flat().filter((v): v is number => v !== null);
    const top = Math.max(0, ...flat) || 1;
    const bottom = Math.abs(Math.min(0, ...flat)) || 1;
    const shade = values.map((row) => row.map((v) => (v === null ? null : v > 0 ? v / top : v / bottom)));
    const text = values.map((row, r) =>
      row.map((v, c) => (v === null ? '' : `${fmtChange(v, decimals)}${partial[r][c] ? '*' : ''}`)),
    );
    const trace = {
      type: 'heatmap',
      z: shade,
      customdata: values,
      x: MONTHS,
      y: years.map(String),
      text,
      texttemplate: '%{text}',
      textfont: { family: font.family, size: font.plotlySize, color: colors.text },
      zmin: -1,
      zmax: 1,
      zmid: 0,
      xgap: 3,
      ygap: 3,
      colorscale: heatScale,
      showscale: false,
      hoverongaps: false,
      hovertemplate: `%{y} %{x}: %{customdata:+.${decimals}f} ${unit}<extra></extra>`,
    } as unknown as Plotly.Data;
    return {
      data: [trace],
      layout: {
        margin: { l: 44, r: 8, t: 22, b: 6 },
        xaxis: { side: 'top', showgrid: false, zeroline: false, tickfont: { color: colors.muted, size: 10 }, fixedrange: true },
        yaxis: { autorange: 'reversed', showgrid: false, zeroline: false, tickfont: { color: colors.muted, size: 10 }, fixedrange: true },
      } as Partial<Plotly.Layout>,
    };
  }, [years, values, partial, unit, decimals]);

  return <PlotlyChart data={data} layout={layout} />;
}
