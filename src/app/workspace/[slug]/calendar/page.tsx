'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, formatDistanceToNow, startOfWeek } from 'date-fns';
import { useMissionControl } from '@/lib/store';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Play,
  Pause,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  XCircle,
  CalendarDays,
  Activity,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CronJobState = {
  lastStatus?: string;
  lastRunStatus?: string;
  lastRunAtMs?: number;
  nextRunAtMs?: number;
  lastError?: string;
  runCount?: number;
  successCount?: number;
  failureCount?: number;
};

type CronSchedule =
  | { kind: 'every'; everyMs: number; anchorMs?: number }
  | { kind: 'cron'; expr: string; tz?: string }
  | { kind: 'at'; at: string };

type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule?: CronSchedule;
  description?: string;
  state?: CronJobState;
};

type CronRaw = {
  jobs?: CronJob[];
  writeEnabled?: boolean;
  ok?: boolean;
  error?: string;
};

type SortKey = 'name' | 'status' | 'nextRun' | 'lastRun';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(ms: number | undefined): string {
  if (!ms) return '—';
  return formatDistanceToNow(new Date(ms), { addSuffix: true });
}

function fmtAbsTs(ms: number | undefined): string {
  if (!ms) return '—';
  return format(new Date(ms), 'MMM d, HH:mm:ss');
}

function fmtSchedule(schedule: CronSchedule | undefined): string {
  if (!schedule) return '—';
  switch (schedule.kind) {
    case 'every': {
      const ms = schedule.everyMs;
      if (ms < 60_000) return `Every ${Math.round(ms / 1000)}s`;
      if (ms < 3_600_000) return `Every ${Math.round(ms / 60_000)}m`;
      if (ms < 86_400_000) return `Every ${Math.round(ms / 3_600_000)}h`;
      return `Every ${Math.round(ms / 86_400_000)}d`;
    }
    case 'cron':
      return `cron: ${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ''}`;
    case 'at':
      return `At: ${schedule.at}`;
    default:
      return '—';
  }
}

function jobLastStatus(job: CronJob): string {
  return job.state?.lastRunStatus || job.state?.lastStatus || 'unknown';
}

function isFailingJob(job: CronJob): boolean {
  const s = jobLastStatus(job);
  return s === 'error' || s === 'failure' || s === 'failed';
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-bg-tertiary text-mc-text-secondary">
        <ToggleLeft className="w-3 h-3" />
        disabled
      </span>
    );
  }
  if (status === 'success' || status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-accent-green/20 text-mc-accent-green">
        <CheckCircle2 className="w-3 h-3" />
        ok
      </span>
    );
  }
  if (status === 'error' || status === 'failure' || status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-accent-red/20 text-mc-accent-red">
        <XCircle className="w-3 h-3" />
        failing
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-accent/20 text-mc-accent">
        <Activity className="w-3 h-3 animate-pulse" />
        running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-accent-green/10 text-mc-accent-green/70">
      <ToggleRight className="w-3 h-3" />
      enabled
    </span>
  );
}

// ─── CronJobRow ───────────────────────────────────────────────────────────────

function CronJobRow({
  job,
  writeEnabled,
  busy,
  onAction,
}: {
  job: CronJob;
  writeEnabled: boolean;
  busy: string | null;
  onAction: (id: string, action: 'run-now' | 'enable' | 'disable') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isBusy = busy?.startsWith(`${job.id}:`);
  const lastStatus = jobLastStatus(job);
  const failing = isFailingJob(job);

  return (
    <>
      <tr
        className={`border-b border-mc-border/40 hover:bg-mc-bg-tertiary/30 transition-colors cursor-pointer ${
          failing && job.enabled ? 'bg-mc-accent-red/5' : ''
        }`}
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-2.5 pl-3 pr-2 w-5">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-mc-text-secondary" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-mc-text-secondary" />
          )}
        </td>
        <td className="py-2.5 pr-4 max-w-[220px]">
          <div className="text-sm font-medium truncate">{job.name}</div>
          {job.schedule && (
            <div className="text-xs text-mc-text-secondary font-mono mt-0.5">{fmtSchedule(job.schedule)}</div>
          )}
        </td>
        <td className="py-2.5 pr-4">
          <StatusBadge status={lastStatus} enabled={job.enabled} />
        </td>
        <td className="py-2.5 pr-4 text-xs text-mc-text-secondary whitespace-nowrap">
          {fmtTs(job.state?.nextRunAtMs)}
          {job.state?.nextRunAtMs && (
            <div className="text-[10px] text-mc-text-secondary/60 mt-0.5">
              {fmtAbsTs(job.state.nextRunAtMs)}
            </div>
          )}
        </td>
        <td className="py-2.5 pr-4 text-xs text-mc-text-secondary whitespace-nowrap">
          {fmtTs(job.state?.lastRunAtMs)}
          {job.state?.lastRunAtMs && (
            <div className="text-[10px] text-mc-text-secondary/60 mt-0.5">
              {fmtAbsTs(job.state.lastRunAtMs)}
            </div>
          )}
        </td>
        <td className="py-2.5 pr-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={() => onAction(job.id, 'run-now')}
              disabled={isBusy || !writeEnabled}
              title={writeEnabled ? 'Run now' : 'Write controls disabled'}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-mc-accent/15 text-mc-accent hover:bg-mc-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-3 h-3" />
              Run
            </button>
            {job.enabled ? (
              <button
                onClick={() => onAction(job.id, 'disable')}
                disabled={isBusy || !writeEnabled}
                title={writeEnabled ? 'Disable job' : 'Write controls disabled'}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-mc-accent-red/15 text-mc-accent-red hover:bg-mc-accent-red/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Pause className="w-3 h-3" />
                Disable
              </button>
            ) : (
              <button
                onClick={() => onAction(job.id, 'enable')}
                disabled={isBusy || !writeEnabled}
                title={writeEnabled ? 'Enable job' : 'Write controls disabled'}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-mc-accent-green/15 text-mc-accent-green hover:bg-mc-accent-green/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ToggleRight className="w-3 h-3" />
                Enable
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-mc-border/40 bg-mc-bg-tertiary/20">
          <td colSpan={6} className="px-8 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-mc-text-secondary uppercase tracking-wider text-[10px] mb-1">Job ID</div>
                <div className="font-mono text-mc-text break-all">{job.id}</div>
              </div>
              {job.description && (
                <div className="col-span-2">
                  <div className="text-mc-text-secondary uppercase tracking-wider text-[10px] mb-1">Description</div>
                  <div className="text-mc-text">{job.description}</div>
                </div>
              )}
              {job.state?.lastError && (
                <div className="col-span-2 md:col-span-4">
                  <div className="text-mc-accent-red uppercase tracking-wider text-[10px] mb-1">Last Error</div>
                  <div className="font-mono text-mc-accent-red/80 text-[11px] bg-mc-accent-red/5 rounded p-2 break-all">
                    {job.state.lastError}
                  </div>
                </div>
              )}
              {(job.state?.runCount !== undefined || job.state?.successCount !== undefined) && (
                <div>
                  <div className="text-mc-text-secondary uppercase tracking-wider text-[10px] mb-1">Run Stats</div>
                  <div className="text-mc-text">
                    {job.state.runCount !== undefined && <span>{job.state.runCount} total</span>}
                    {job.state.successCount !== undefined && (
                      <span className="text-mc-accent-green ml-2">✓ {job.state.successCount}</span>
                    )}
                    {job.state.failureCount !== undefined && (
                      <span className="text-mc-accent-red ml-2">✗ {job.state.failureCount}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── UpcomingRunsPanel ────────────────────────────────────────────────────────

function UpcomingRunsPanel({ jobs }: { jobs: CronJob[] }) {
  const upcoming = useMemo(() => {
    return jobs
      .filter((j) => j.enabled && j.state?.nextRunAtMs)
      .map((j) => ({ name: j.name, nextRunAtMs: j.state!.nextRunAtMs! }))
      .sort((a, b) => a.nextRunAtMs - b.nextRunAtMs)
      .slice(0, 8);
  }, [jobs]);

  if (upcoming.length === 0) {
    return (
      <div className="text-xs text-mc-text-secondary/60 py-4 text-center">No upcoming runs scheduled</div>
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-1.5">
      {upcoming.map((run, i) => {
        const diffMs = run.nextRunAtMs - now;
        const soon = diffMs < 5 * 60 * 1000;
        return (
          <div
            key={`${run.name}-${i}`}
            className={`flex items-center justify-between rounded p-2 text-xs ${
              soon ? 'bg-mc-accent/10 border border-mc-accent/20' : 'bg-mc-bg border border-mc-border/40'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${soon ? 'text-mc-accent' : 'text-mc-text-secondary'}`} />
              <span className="truncate font-medium">{run.name}</span>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <div className={soon ? 'text-mc-accent font-medium' : 'text-mc-text-secondary'}>
                {fmtTs(run.nextRunAtMs)}
              </div>
              <div className="text-[10px] text-mc-text-secondary/60">{fmtAbsTs(run.nextRunAtMs)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── RecentFailuresPanel ──────────────────────────────────────────────────────

function RecentFailuresPanel({ jobs }: { jobs: CronJob[] }) {
  const failures = useMemo(() => {
    return jobs
      .filter((j) => isFailingJob(j))
      .map((j) => ({
        id: j.id,
        name: j.name,
        lastRunAtMs: j.state?.lastRunAtMs,
        lastError: j.state?.lastError,
        enabled: j.enabled,
      }))
      .sort((a, b) => (b.lastRunAtMs || 0) - (a.lastRunAtMs || 0))
      .slice(0, 5);
  }, [jobs]);

  if (failures.length === 0) {
    return (
      <div className="text-xs text-mc-accent-green flex items-center gap-2 py-4">
        <CheckCircle2 className="w-4 h-4" />
        No recent failures
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {failures.map((f) => (
        <div key={f.id} className="rounded border border-mc-accent-red/30 bg-mc-accent-red/5 p-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-mc-accent-red flex-shrink-0" />
              <span className="font-medium truncate">{f.name}</span>
            </div>
            <span className="text-mc-text-secondary/70 flex-shrink-0">{fmtTs(f.lastRunAtMs)}</span>
          </div>
          {f.lastError && (
            <div className="mt-1.5 ml-5 font-mono text-[10px] text-mc-accent-red/70 bg-mc-accent-red/10 rounded px-2 py-1 break-all">
              {f.lastError}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TaskCalendarSection ──────────────────────────────────────────────────────

function TaskCalendarSection() {
  const { tasks } = useMissionControl();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dueTasks = useMemo(
    () => tasks.filter((t) => t.due_date && t.status !== 'done'),
    [tasks]
  );

  const priorityColor = (p: string) => {
    if (p === 'urgent') return 'border-mc-accent-red/60 bg-mc-accent-red/10';
    if (p === 'high') return 'border-mc-accent/40 bg-mc-accent/8';
    if (p === 'normal') return 'border-mc-border/60 bg-mc-bg-tertiary';
    return 'border-mc-border/30 bg-mc-bg-tertiary/60';
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-mc-text-secondary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mc-text-secondary">
          Task Schedule — This Week
        </h2>
      </div>
      <div className="grid grid-cols-7 gap-2 min-w-[840px]">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = dueTasks.filter((t) => (t.due_date || '').startsWith(key));
          const isToday = key === today;

          return (
            <div
              key={key}
              className={`rounded-lg border min-h-[140px] p-2 ${
                isToday
                  ? 'border-mc-accent/40 bg-mc-accent/5'
                  : 'border-mc-border bg-mc-bg-secondary'
              }`}
            >
              <div className={`text-xs font-semibold mb-0.5 ${isToday ? 'text-mc-accent' : ''}`}>
                {format(day, 'EEE')}
              </div>
              <div className={`text-[11px] mb-2 ${isToday ? 'text-mc-accent/70' : 'text-mc-text-secondary'}`}>
                {format(day, 'MMM d')}
                {isToday && <span className="ml-1 text-[9px] uppercase tracking-wider">today</span>}
              </div>
              <div className="space-y-1.5">
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`rounded border p-1.5 text-[11px] ${priorityColor(task.priority)}`}
                  >
                    <div className="font-medium truncate leading-tight">{task.title}</div>
                    <div className="text-mc-text-secondary/70 mt-0.5 capitalize">{task.priority}</div>
                  </div>
                ))}
                {dayTasks.length === 0 && (
                  <div className="text-[10px] text-mc-text-secondary/40">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [cronData, setCronData] = useState<CronRaw>({ jobs: [], writeEnabled: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showDisabled, setShowDisabled] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadCron = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/openclaw/cron/raw');
      const body: CronRaw = await res.json();
      if (body.ok === false && body.error) {
        setError(body.error);
      } else {
        setCronData(body);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cron data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCron();
    const timer = setInterval(() => loadCron(true), 30000);
    return () => clearInterval(timer);
  }, [loadCron]);

  const handleAction = useCallback(
    async (id: string, action: 'run-now' | 'enable' | 'disable') => {
      setActionError(null);
      setBusy(`${id}:${action}`);
      try {
        const res = await fetch('/api/openclaw/cron/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action }),
        });
        const body = await res.json();
        if (!res.ok || !body?.ok) {
          setActionError(body?.error || 'Action failed');
        }
        await loadCron(true);
      } finally {
        setBusy(null);
      }
    },
    [loadCron]
  );

  const jobs = cronData.jobs ?? [];
  const writeEnabled = cronData.writeEnabled ?? false;

  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q) ||
          (j.description || '').toLowerCase().includes(q) ||
          fmtSchedule(j.schedule).toLowerCase().includes(q)
      );
    }
    if (!showDisabled) {
      result = result.filter((j) => j.enabled);
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'status') {
        const sa = a.enabled ? 1 : 0;
        const sb = b.enabled ? 1 : 0;
        cmp = sb - sa;
      } else if (sortKey === 'nextRun') {
        cmp = (a.state?.nextRunAtMs || 0) - (b.state?.nextRunAtMs || 0);
      } else if (sortKey === 'lastRun') {
        cmp = (b.state?.lastRunAtMs || 0) - (a.state?.lastRunAtMs || 0);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [jobs, filterText, showDisabled, sortKey, sortAsc]);

  const stats = useMemo(() => {
    const enabled = jobs.filter((j) => j.enabled);
    const failing = jobs.filter((j) => isFailingJob(j) && j.enabled);
    const nextRun = enabled
      .map((j) => j.state?.nextRunAtMs)
      .filter((t): t is number => typeof t === 'number')
      .sort((a, b) => a - b)[0];
    return { total: jobs.length, enabled: enabled.length, failing: failing.length, nextRun };
  }, [jobs]);

  function SortHeader({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <th
        className={`py-2 pr-4 text-left text-[11px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${
          active ? 'text-mc-accent' : 'text-mc-text-secondary hover:text-mc-text'
        }`}
        onClick={() => {
          if (active) setSortAsc((a) => !a);
          else { setSortKey(k); setSortAsc(true); }
        }}
      >
        {label}
        {active && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
      </th>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-5">
      {/* Header */}
      <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-mc-accent" />
              Schedule &amp; Cron
            </h1>
            <p className="text-sm text-mc-text-secondary mt-0.5">
              Lifecycle management for all scheduled jobs
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-[11px] text-mc-text-secondary/60">
                Updated {format(lastRefreshed, 'HH:mm:ss')}
              </span>
            )}
            <button
              onClick={() => loadCron(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-mc-border text-xs text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Total Jobs', value: loading ? '…' : String(stats.total), color: 'text-mc-text' },
            { label: 'Enabled', value: loading ? '…' : String(stats.enabled), color: 'text-mc-accent-green' },
            {
              label: 'Failing',
              value: loading ? '…' : String(stats.failing),
              color: stats.failing > 0 ? 'text-mc-accent-red' : 'text-mc-text-secondary',
            },
            {
              label: 'Next Run',
              value: loading ? '…' : fmtTs(stats.nextRun),
              color: 'text-mc-accent',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded border border-mc-border bg-mc-bg p-3 text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-[11px] text-mc-text-secondary mt-0.5 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {!writeEnabled && (
          <div className="mt-3 flex items-center gap-2 rounded border border-mc-accent-yellow/40 bg-mc-accent-yellow/10 px-3 py-2 text-xs text-mc-accent-yellow">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Write controls are disabled. Set{' '}
            <code className="font-mono bg-mc-accent-yellow/20 px-1 rounded">MC_CRON_CONTROLS_WRITE_ENABLED=true</code>{' '}
            to enable run/enable/disable.
          </div>
        )}
        {actionError && (
          <div className="mt-3 flex items-center gap-2 rounded border border-mc-accent-red/40 bg-mc-accent-red/10 px-3 py-2 text-xs text-mc-accent-red">
            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {actionError}
            <button onClick={() => setActionError(null)} className="ml-auto text-mc-accent-red/60 hover:text-mc-accent-red">✕</button>
          </div>
        )}
      </div>

      {/* Main Layout: Table + Side Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        {/* Job Table */}
        <div className="rounded-lg border border-mc-border bg-mc-bg-secondary overflow-hidden">
          <div className="flex items-center gap-3 p-3 border-b border-mc-border/60 bg-mc-bg-tertiary/40">
            <input
              type="text"
              placeholder="Filter jobs…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="flex-1 min-w-0 rounded border border-mc-border bg-mc-bg px-3 py-1.5 text-xs text-mc-text placeholder:text-mc-text-secondary/60 focus:outline-none focus:border-mc-accent/60"
            />
            <label className="flex items-center gap-1.5 text-xs text-mc-text-secondary cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showDisabled}
                onChange={(e) => setShowDisabled(e.target.checked)}
                className="accent-mc-accent"
              />
              Show disabled
            </label>
            <span className="text-[11px] text-mc-text-secondary/60 whitespace-nowrap">
              {filteredJobs.length} / {jobs.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-mc-text-secondary">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading cron jobs…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-sm text-mc-accent-red gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-16 text-center text-sm text-mc-text-secondary">
              {jobs.length === 0
                ? 'No cron jobs found. Make sure OpenClaw is connected.'
                : 'No jobs match the current filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-mc-border/60 bg-mc-bg-tertiary/30">
                  <tr>
                    <th className="w-5 pl-3" />
                    <SortHeader k="name" label="Job Name" />
                    <SortHeader k="status" label="Status" />
                    <SortHeader k="nextRun" label="Next Run" />
                    <SortHeader k="lastRun" label="Last Run" />
                    <th className="py-2 pr-3 text-right text-[11px] uppercase tracking-wider text-mc-text-secondary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <CronJobRow
                      key={job.id}
                      job={job}
                      writeEnabled={writeEnabled}
                      busy={busy}
                      onAction={handleAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side Panels */}
        <div className="space-y-4">
          <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Upcoming Runs
            </h3>
            <UpcomingRunsPanel jobs={jobs} />
          </div>

          <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Recent Failures
              {stats.failing > 0 && (
                <span className="ml-auto bg-mc-accent-red text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {stats.failing}
                </span>
              )}
            </h3>
            <RecentFailuresPanel jobs={jobs} />
          </div>
        </div>
      </div>

      {/* Task Calendar */}
      <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4 overflow-x-auto">
        <TaskCalendarSection />
      </div>
    </div>
  );
}
