import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartCard, Segmented, StateText } from '../components/ChartCard';
import { POLL, usePoll, type Headline, type NewsPayload, type NewsTopic, type Story } from '../api';
import { fmtNewsStamp, fmtNewsTime } from '../format';
import { colors, font } from '../theme';

/** Reuters alerts are all-caps one-liners. */
const isAlert = (headline: string) => /[A-Z]/.test(headline) && headline === headline.toUpperCase();

/** Ids that arrived since the previous poll (none on the first load or after switching topic). */
function useNewIds(items: Headline[] | undefined, feedKey: string): Set<string> {
  const last = useRef<{ key: string; items: Headline[]; ids: Set<string>; fresh: Set<string> } | null>(null);
  return useMemo(() => {
    if (!items) return new Set<string>();
    if (last.current?.items === items) return last.current.fresh;
    const previous = last.current?.key === feedKey ? last.current.ids : null;
    const fresh = new Set(previous ? items.filter((h) => !previous.has(h.id)).map((h) => h.id) : []);
    last.current = { key: feedKey, items, ids: new Set(items.map((h) => h.id)), fresh };
    return fresh;
  }, [items, feedKey]);
}

function HeadlineList({
  feedPath,
  feedKey,
  selected,
  onSelect,
}: {
  feedPath: string;
  feedKey: string;
  selected: string | null;
  onSelect: (headline: Headline | null) => void;
}) {
  const { data, error, loading } = usePoll<NewsPayload>(feedPath, POLL.news);
  const fresh = useNewIds(data?.items, feedKey);

  // Open the newest story when a feed loads and nothing in it is selected. Runs on new data only, not on clicks.
  useEffect(() => {
    if (data && !data.items.some((h) => h.id === selected)) onSelect(data.items[0] ?? null);
  }, [data, feedKey]);

  if (!data) return <StateText loading={loading} error={error} />;
  if (!data.items.length) return <StateText empty />;
  return (
    <div className="h-full overflow-auto">
      {error && <p className="px-2 py-1 text-[10px] text-terminal-down">REFRESH FAILED · {error}</p>}
      <ul>
        {data.items.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onSelect(h)}
              className={`flex w-full items-baseline gap-2 border-b border-terminal-border px-2 py-[3px] text-left text-[11px] hover:bg-terminal-raised ${
                h.id === selected ? 'bg-terminal-active' : ''
              }`}
            >
              <span className={`num shrink-0 ${fresh.has(h.id) ? 'text-terminal-warn font-bold' : 'text-terminal-muted'}`}>
                {fmtNewsTime(h.time)}
              </span>
              {h.source !== 'RTRS' && <span className="shrink-0 text-[9px] font-bold text-terminal-info">{h.source}</span>}
              <span className={`min-w-0 truncate ${isAlert(h.headline) ? 'font-bold text-terminal-warn' : ''}`} title={h.headline}>
                {h.headline}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Story HTML comes from Reuters; it renders in a sandboxed frame (no scripts) restyled to match the terminal.
const STORY_STYLE = `
  body { margin: 10px 14px; background: ${colors.panel}; color: ${colors.text}; font: 12px/1.6 ${font.family}; }
  a { color: ${colors.info}; }
  p { margin: 0 0 8px; }
  pre { white-space: pre-wrap; font: inherit; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid ${colors.border}; padding: 2px 6px; }
  .tr-dateline { color: ${colors.muted}; }
  .tr-signoff, .tr-contactinfo { color: ${colors.muted}; }
`;

function StoryView({ headline }: { headline: Headline }) {
  const { data, error, loading } = usePoll<Story>(`/api/news/story?id=${encodeURIComponent(headline.id)}`, 0);
  const html = data?.id === headline.id ? data.html : null;
  if (html === null) return <StateText loading={loading} error={error} />;
  if (!html.trim()) {
    // Alerts have no body: the headline is the story.
    return <p className="p-3 text-[12px] font-bold text-terminal-warn">{headline.headline}</p>;
  }
  return (
    <iframe
      title={headline.headline}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${STORY_STYLE}</style></head><body>${html}</body></html>`}
      className="h-full w-full border-0"
      style={{ background: colors.panel }}
    />
  );
}

/** Reuters headlines by topic or free-text search on the left, the selected story on the right. */
export function NewsPanels() {
  const topics = usePoll<{ topics: NewsTopic[] }>('/api/news/topics', 0);
  const options = (topics.data?.topics ?? []).map((t) => ({ label: t.label, value: t.key }));
  const [topic, setTopic] = useState('eur_rates');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Headline | null>(null);

  const feedKey = search ? `q:${search}` : `t:${topic}`;
  const feedPath = search ? `/api/news?q=${encodeURIComponent(search)}` : `/api/news?topic=${topic}`;

  const chooseTopic = (key: string) => {
    setSearch('');
    setDraft('');
    setTopic(key);
  };

  return (
    <>
      <div className="h-[320px] lg:col-span-5">
        <ChartCard
          title="REUTERS NEWS"
          subtitle={search ? `SEARCH · ${search}` : undefined}
          controls={<Segmented options={options} value={search ? '' : topic} onChange={chooseTopic} />}
        >
          <div className="flex h-full flex-col">
            <form
              className="flex items-center gap-1 border-b border-terminal-border px-2 py-[3px]"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(draft.trim());
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder='SEARCH REUTERS · e.g. Lagarde inflation  ·  "OAT spread"  ·  ECB OR Bundesbank'
                className="min-w-0 flex-1 bg-transparent text-[11px] text-terminal-text placeholder:text-terminal-muted focus:outline-none"
              />
              {search && (
                <button type="button" className="ctl" onClick={() => chooseTopic(topic)}>
                  CLEAR
                </button>
              )}
            </form>
            <div className="relative min-h-0 flex-1">
              <HeadlineList feedPath={feedPath} feedKey={feedKey} selected={selected?.id ?? null} onSelect={setSelected} />
            </div>
          </div>
        </ChartCard>
      </div>
      <div className="h-[320px] lg:col-span-7">
        <ChartCard
          title={selected ? <span title={selected.headline}>{selected.headline}</span> : 'STORY'}
          subtitle={selected ? `${fmtNewsStamp(selected.time)} · ${selected.source}` : undefined}
        >
          {selected ? <StoryView headline={selected} /> : <StateText empty />}
        </ChartCard>
      </div>
    </>
  );
}
