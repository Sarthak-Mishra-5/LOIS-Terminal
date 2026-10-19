import { useEffect, useState } from 'react';
import { POLL, usePoll, type Status } from '../api';
import { londonClock, utcClock } from '../format';

export function Header({ page }: { page: 'dashboard' | 'gallery' }) {
  const status = usePoll<Status>('/api/status', POLL.status);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const apiDown = Boolean(status.error);
  const lsegLive = !apiDown && status.data?.lseg.connected === true;
  const lsegText = apiDown ? 'API UNREACHABLE' : lsegLive ? 'LIVE' : status.data ? 'LSEG DISCONNECTED' : 'CONNECTING';
  const ecbOk = status.data?.ecb.ok;

  return (
    <header className="flex h-8 shrink-0 items-center justify-between gap-4 border-b border-terminal-border bg-terminal-raised px-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="label text-[12px] text-terminal-text">LOIS TERMINAL</span>
        <span className="hidden truncate text-[10px] text-terminal-muted sm:inline">
          EUR MONEY MARKETS · LSEG WORKSPACE + ECB DATA PORTAL
        </span>
      </div>
      <nav className="flex items-center gap-1">
        <a href="#/" className={`ctl ${page === 'dashboard' ? 'ctl-active' : ''}`}>DASHBOARD</a>
        <a href="#/gallery" className={`ctl ${page === 'gallery' ? 'ctl-active' : ''}`}>CHART GALLERY</a>
      </nav>
      <div className="flex items-center gap-4 text-[11px] num">
        <span
          className="flex items-center gap-[6px] font-bold"
          title={status.data?.lseg.error ?? status.error ?? undefined}
        >
          <span className={lsegLive ? 'live-dot' : 'dead-dot'} />
          <span className={lsegLive ? 'text-terminal-up' : 'text-terminal-down'}>{lsegText}</span>
        </span>
        <span className="text-[10px]" title={status.data?.ecb.error ?? undefined}>
          <span className="text-terminal-muted">ECB </span>
          <span className={ecbOk === false ? 'text-terminal-down' : ecbOk ? 'text-terminal-up' : 'text-terminal-muted'}>
            {ecbOk === false ? 'ERROR' : ecbOk ? 'OK' : '—'}
          </span>
        </span>
        <span>
          <span className="text-terminal-muted">LDN </span>
          {londonClock.format(now)}
        </span>
        <span className="font-bold">{utcClock.format(now)} UTC</span>
      </div>
    </header>
  );
}
