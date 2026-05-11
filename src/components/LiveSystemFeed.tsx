'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Pause, Play, Wifi, WifiOff } from 'lucide-react';

const MAX_FEED_ITEMS = 200;
const PAPERCLIP_POLL_INTERVAL_MS = 30_000;

interface FeedItem {
  id: string;
  kind: 'mc' | 'paperclip_run' | 'paperclip_transition';
  type: string;
  agentName?: string;
  agentEmoji?: string;
  taskTitle?: string;
  message: string;
  timestamp: string;
}

interface PaperclipRun {
  id: string;
  agentName?: string;
  issueIdentifier?: string;
  issueTitle?: string;
  status: string;
  startedAt: string;
  updatedAt: string;
}

interface PaperclipTransition {
  id: string;
  identifier: string;
  title: string;
  status: string;
  assigneeName?: string;
  updatedAt: string;
}

function eventColor(type: string): string {
  if (type.includes('done') || type.includes('completed') || type.includes('closed')) return 'bg-mc-accent-green';
  if (type.includes('blocked') || type.includes('error') || type.includes('failed')) return 'bg-mc-accent-red';
  if (type.includes('created') || type.includes('joined') || type.includes('started')) return 'bg-mc-accent';
  if (type.includes('status') || type.includes('assigned')) return 'bg-mc-accent-yellow';
  return 'bg-mc-border';
}

function eventBadgeStyle(type: string): string {
  if (type.includes('done') || type.includes('completed')) return 'text-mc-accent-green border-mc-accent-green/40 bg-mc-accent-green/10';
  if (type.includes('blocked') || type.includes('error')) return 'text-mc-accent-red border-mc-accent-red/40 bg-mc-accent-red/10';
  if (type.includes('created') || type.includes('started')) return 'text-mc-accent border-mc-accent/40 bg-mc-accent/10';
  if (type.includes('in_progress')) return 'text-mc-accent-yellow border-mc-accent-yellow/40 bg-mc-accent-yellow/10';
  return 'text-mc-text-secondary border-mc-border bg-mc-bg';
}

function paperclipStatusBadgeStyle(status: string): string {
  if (status === 'done') return 'text-mc-accent-green border-mc-accent-green/40 bg-mc-accent-green/10';
  if (status === 'blocked' || status === 'cancelled') return 'text-mc-accent-red border-mc-accent-red/40 bg-mc-accent-red/10';
  if (status === 'in_progress' || status === 'running') return 'text-mc-accent-yellow border-mc-accent-yellow/40 bg-mc-accent-yellow/10';
  if (status === 'in_review') return 'text-mc-accent border-mc-accent/40 bg-mc-accent/10';
  return 'text-mc-text-secondary border-mc-border bg-mc-bg';
}

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === 'paperclip_run') {
    return (
      <div className="flex gap-3 px-4 py-2.5 border-b border-mc-border/50 hover:bg-mc-bg-secondary/50 transition-colors">
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${paperclipStatusBadgeStyle(item.type).includes('green') ? 'bg-mc-accent-green' : 'bg-mc-accent-yellow'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase ${paperclipStatusBadgeStyle(item.type)}`}>
              run
            </span>
            {item.agentEmoji && <span>{item.agentEmoji}</span>}
            <span className="text-sm font-medium truncate">{item.message}</span>
          </div>
          {item.taskTitle && (
            <div className="text-xs text-mc-text-secondary mt-0.5 truncate">{item.taskTitle}</div>
          )}
        </div>
        <div className="text-[11px] text-mc-text-secondary whitespace-nowrap shrink-0 mt-0.5">
          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </div>
      </div>
    );
  }

  if (item.kind === 'paperclip_transition') {
    return (
      <div className="flex gap-3 px-4 py-2.5 border-b border-mc-border/50 hover:bg-mc-bg-secondary/50 transition-colors">
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
          item.type === 'done' ? 'bg-mc-accent-green' :
          item.type === 'blocked' ? 'bg-mc-accent-red' :
          item.type === 'in_progress' ? 'bg-mc-accent-yellow' :
          'bg-mc-accent'
        }`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase ${paperclipStatusBadgeStyle(item.type)}`}>
              {item.type}
            </span>
            {item.agentName && (
              <span className="text-xs text-mc-text-secondary">{item.agentName}</span>
            )}
            <span className="text-sm font-medium truncate">{item.message}</span>
          </div>
          {item.taskTitle && (
            <div className="text-xs text-mc-text-secondary mt-0.5 font-mono">{item.taskTitle}</div>
          )}
        </div>
        <div className="text-[11px] text-mc-text-secondary whitespace-nowrap shrink-0 mt-0.5">
          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </div>
      </div>
    );
  }

  // mc event
  return (
    <div className="flex gap-3 px-4 py-2.5 border-b border-mc-border/50 hover:bg-mc-bg-secondary/50 transition-colors">
      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${eventColor(item.type)}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${eventBadgeStyle(item.type)}`}>
            {item.type.replace(/_/g, ' ')}
          </span>
          {item.agentEmoji && item.agentName && (
            <span className="text-xs text-mc-text-secondary shrink-0">{item.agentEmoji} {item.agentName}</span>
          )}
          <span className="text-sm truncate">{item.message}</span>
        </div>
        {item.taskTitle && (
          <div className="text-xs text-mc-text-secondary mt-0.5 truncate">{item.taskTitle}</div>
        )}
      </div>
      <div className="text-[11px] text-mc-text-secondary whitespace-nowrap shrink-0 mt-0.5">
        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
      </div>
    </div>
  );
}

interface Props {
  maxHeight?: string;
}

export function LiveSystemFeed({ maxHeight = '480px' }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeRunCount, setActiveRunCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seenIds = useRef(new Set<string>());
  const latestTimestampRef = useRef<string>('');

  const addItems = useCallback((incoming: FeedItem[]) => {
    const fresh = incoming.filter((item) => !seenIds.current.has(item.id));
    if (fresh.length === 0) return;
    fresh.forEach((item) => seenIds.current.add(item.id));
    if (fresh[0] && fresh[0].timestamp > (latestTimestampRef.current || '')) {
      latestTimestampRef.current = fresh[0].timestamp;
    }
    setItems((prev) => {
      const merged = [...fresh, ...prev];
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return merged.slice(0, MAX_FEED_ITEMS);
    });
  }, []);

  // Initial feed load from MC DB
  useEffect(() => {
    fetch('/api/activity/feed?limit=80')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.events) addItems(data.events);
      })
      .catch(console.error);
  }, [addItems]);

  // Paperclip poll for active runs + recent transitions
  const pollPaperclip = useCallback(async () => {
    try {
      const res = await fetch('/api/activity/paperclip');
      if (!res.ok) return;
      const data = await res.json();

      setActiveRunCount(data.activeRuns?.length ?? 0);

      const runItems: FeedItem[] = (data.activeRuns ?? []).map((r: PaperclipRun) => ({
        id: `run_${r.id}`,
        kind: 'paperclip_run' as const,
        type: r.status,
        agentName: r.agentName,
        message: r.agentName
          ? `${r.agentName} running${r.issueIdentifier ? ` · ${r.issueIdentifier}` : ''}`
          : 'Agent run active',
        taskTitle: r.issueTitle,
        timestamp: r.updatedAt ?? r.startedAt,
      }));

      const transitionItems: FeedItem[] = (data.recentTransitions ?? []).map((t: PaperclipTransition) => ({
        id: `transition_${t.id}_${t.status}`,
        kind: 'paperclip_transition' as const,
        type: t.status,
        agentName: t.assigneeName,
        message: t.title,
        taskTitle: t.identifier,
        timestamp: t.updatedAt,
      }));

      addItems([...runItems, ...transitionItems]);
    } catch {
      // silently ignore
    }
  }, [addItems]);

  useEffect(() => {
    pollPaperclip();
    pollTimerRef.current = setInterval(pollPaperclip, PAPERCLIP_POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollPaperclip]);

  // SSE for MC real-time events
  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/events/stream');
      esRef.current = es;

      es.onopen = () => setSseConnected(true);

      es.onmessage = (e) => {
        if (!e.data || e.data.startsWith(':')) return;
        try {
          const payload = JSON.parse(e.data);
          if (!payload?.type || !payload?.payload) return;

          const p = payload.payload;
          const now = new Date().toISOString();

          const item: FeedItem = {
            id: `sse_${payload.type}_${p.id ?? p.taskId ?? now}`,
            kind: 'mc',
            type: payload.type,
            agentName: p.agent?.name ?? p.agentName,
            agentEmoji: p.agent?.avatar_emoji,
            taskTitle: p.title ?? p.task?.title,
            message: (() => {
              if (payload.type === 'task_updated') return `Task updated: ${p.title ?? p.id}`;
              if (payload.type === 'task_created') return `New task: ${p.title}`;
              if (payload.type === 'activity_logged') return p.summary ?? 'Activity logged';
              if (payload.type === 'deliverable_added') return `Deliverable added to ${p.task?.title ?? p.taskId}`;
              if (payload.type === 'agent_session_started') return `${p.agentName ?? 'Agent'} session started`;
              if (payload.type === 'agent_session_ended') return `${p.agentName ?? 'Agent'} session ended`;
              return payload.type.replace(/_/g, ' ');
            })(),
            timestamp: p.updated_at ?? p.created_at ?? now,
          };

          if (!pausedRef.current) addItems([item]);
        } catch {
          // ignore malformed SSE payloads
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        esRef.current = null;
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      esRef.current?.close();
    };
  }, [addItems]);

  // Auto-scroll to top (newest) when not paused
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [items, paused]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
  };

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-mc-border shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-mc-accent" />
          <span className="font-semibold text-sm">System Feed</span>
          {activeRunCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-mc-accent-yellow/20 text-mc-accent-yellow border border-mc-accent-yellow/30 font-mono">
              {activeRunCount} run{activeRunCount !== 1 ? 's' : ''} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${
            sseConnected
              ? 'text-mc-accent-green border-mc-accent-green/30 bg-mc-accent-green/10'
              : 'text-mc-text-secondary border-mc-border bg-mc-bg'
          }`}>
            {sseConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {sseConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <button
            onClick={togglePause}
            title={paused ? 'Resume auto-scroll' : 'Pause feed'}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors ${
              paused
                ? 'text-mc-accent border-mc-accent/40 bg-mc-accent/10'
                : 'text-mc-text-secondary border-mc-border bg-mc-bg hover:border-mc-accent/40'
            }`}
          >
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {paused ? 'PAUSED' : 'PAUSE'}
          </button>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        className="overflow-y-auto flex-1 font-mono text-sm"
        style={{ maxHeight }}
        onWheel={() => {
          if (!pausedRef.current) {
            setPaused(true);
            pausedRef.current = true;
          }
        }}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-mc-text-secondary gap-2">
            <Activity className="w-6 h-6 opacity-40" />
            <span className="text-sm">No events yet</span>
          </div>
        ) : (
          items.map((item) => <FeedRow key={item.id} item={item} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-mc-border shrink-0 text-[10px] text-mc-text-secondary flex items-center justify-between">
        <span>{items.length} events</span>
        <span>max {MAX_FEED_ITEMS} · Paperclip refresh every 30s</span>
      </div>
    </div>
  );
}
