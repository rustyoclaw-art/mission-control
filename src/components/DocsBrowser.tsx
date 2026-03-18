'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileSearch } from 'lucide-react';

type DocItem = {
  path: string;
  name: string;
  section: string;
  mtimeMs: number;
  preview: string;
};

type DocsResponse = {
  ok: boolean;
  query: string;
  count: number;
  items: DocItem[];
  error?: string;
};

export function DocsBrowser() {
  const [q, setQ] = useState('mission');
  const [data, setData] = useState<DocsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const debouncedQ = useDebounced(q, 250);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/docs/search?q=${encodeURIComponent(debouncedQ)}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        setData(body);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setData({ ok: false, query: debouncedQ, count: 0, items: [], error: 'Request failed' });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [debouncedQ]);

  const items = useMemo(() => (data?.items || []).slice(0, 12), [data]);

  return (
    <div className="px-3 pb-3">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mc-text-secondary">
          <FileSearch className="w-4 h-4" />
          <span>Docs & Artifacts</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reports/docs..."
            className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
          />
        </div>

        {loading ? (
          <p className="mt-2 text-sm text-mc-text-secondary">Searching…</p>
        ) : !data?.ok ? (
          <p className="mt-2 text-sm text-mc-accent-red">{data?.error || 'Search failed'}</p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-mc-text-secondary">Showing {items.length} of {data.count} matches</p>
            {items.length === 0 ? (
              <p className="text-sm text-mc-text-secondary">No matching docs found.</p>
            ) : (
              items.map((item) => (
                <DocRow key={`${item.path}-${item.mtimeMs}`} item={item} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DocRow({ item }: { item: DocItem }) {
  return (
    <div className="bg-mc-bg border border-mc-border rounded p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{item.name}</div>
          <div className="text-xs text-mc-text-secondary truncate">{item.section} · {item.path}</div>
        </div>
      </div>
      {item.preview ? <p className="mt-1 text-xs text-mc-text-secondary line-clamp-2">{item.preview}</p> : null}
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
