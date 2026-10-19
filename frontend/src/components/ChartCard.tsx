import type { ReactNode } from 'react';
import { colors } from '../theme';

/** Panel shell: #141414 body, #1a1a1a header strip, 1px border, fills its grid cell. */
export function ChartCard({
  title,
  subtitle,
  controls,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-panel border border-terminal-border ${className}`}
      style={{ background: colors.panel, height: '100%', minHeight: 0 }}
    >
      <header
        className="flex items-center justify-between gap-2 border-b border-terminal-border"
        style={{ background: colors.raised, padding: '5px 8px' }}
      >
        <div className="min-w-0 flex items-baseline gap-2">
          <h2 className="label text-[11px] truncate">{title}</h2>
          {subtitle && <span className="text-[10px] text-terminal-muted truncate">{subtitle}</span>}
        </div>
        {controls && <div className="flex shrink-0 items-center gap-1">{controls}</div>}
      </header>
      <div className={`relative flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Outlined uppercase button group, e.g. timeframes. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`ctl ${option.value === value ? 'ctl-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </>
  );
}

/** Loading / error / empty text, in the same muted style everywhere. */
export function StateText({ loading, error, empty }: { loading?: boolean; error?: string | null; empty?: boolean }) {
  let text: string | null = null;
  let tone = 'text-terminal-muted';
  if (error) {
    text = `ERROR · ${error}`;
    tone = 'text-terminal-down';
  } else if (loading) text = 'LOADING…';
  else if (empty) text = 'NO DATA';
  if (!text) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[10px] uppercase tracking-[0.05em]">
      <span className={tone}>{text}</span>
    </div>
  );
}

/** Small amber note for data that is stale or partial. */
export function Warn({ children }: { children: ReactNode }) {
  return <span className="text-terminal-warn text-[10px] uppercase font-bold">{children}</span>;
}
