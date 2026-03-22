'use client';

import { useEffect, useState } from 'react';
import { Play, Pause, ToggleRight } from 'lucide-react';

type Job = {
  id: string;
  name: string;
  enabled: boolean;
  state?: {
    lastStatus?: string;
    nextRunAtMs?: number;
  };
};

type CronRawResponse = {
  jobs?: Job[];
  writeEnabled?: boolean;
};

export function CronControls() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [writeEnabled, setWriteEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/openclaw/cron/raw');
      const body: CronRawResponse = await res.json();
      setJobs(Array.isArray(body?.jobs) ? body.jobs : []);
      setWriteEnabled(Boolean(body?.writeEnabled));
    } catch {
      setJobs([]);
      setWriteEnabled(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const act = async (id: string, action: 'run-now' | 'enable' | 'disable') => {
    setError(null);

    const ok = window.confirm(
      action === 'run-now'
        ? 'Run this cron job now?'
        : action === 'disable'
        ? 'Disable this cron job?'
        : 'Enable this cron job?'
    );
    if (!ok) return;

    setBusy(`${id}:${action}`);
    try {
      const res = await fetch('/api/openclaw/cron/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        setError(body?.error || 'Control action failed');
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-3 pb-3">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mc-text-secondary">
          <ToggleRight className="w-4 h-4" />
          <span>Cron Controls</span>
        </div>

        {!writeEnabled ? (
          <p className="mt-3 text-xs text-mc-accent-yellow">Writes are gated. Set MC_CRON_CONTROLS_WRITE_ENABLED=true to allow run/enable/disable.</p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-mc-accent-red">{error}</p> : null}

        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
          {jobs.slice(0, 10).map((job) => {
            const isBusy = busy?.startsWith(`${job.id}:`);
            return (
              <div key={job.id} className="bg-mc-bg border border-mc-border rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{job.name}</div>
                    <div className="text-xs text-mc-text-secondary">
                      {job.enabled ? 'enabled' : 'disabled'} · {job.state?.lastStatus || 'unknown'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => act(job.id, 'run-now')}
                      disabled={isBusy || !writeEnabled}
                      className="p-1.5 rounded bg-mc-accent/20 text-mc-accent hover:bg-mc-accent/30 disabled:opacity-50"
                      title="Run now"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    {job.enabled ? (
                      <button
                        onClick={() => act(job.id, 'disable')}
                        disabled={isBusy || !writeEnabled}
                        className="p-1.5 rounded bg-mc-accent-red/20 text-mc-accent-red hover:bg-mc-accent-red/30 disabled:opacity-50"
                        title="Disable"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => act(job.id, 'enable')}
                        disabled={isBusy || !writeEnabled}
                        className="px-2 py-1 text-xs rounded bg-mc-accent-green/20 text-mc-accent-green hover:bg-mc-accent-green/30 disabled:opacity-50"
                        title="Enable"
                      >
                        Enable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
