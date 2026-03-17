'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface ProjectSummary {
  project: string;
  taskCount: number;
  counts: Record<string, number>;
  updatedAt?: string;
  error?: string;
}

interface ProjectsResponse {
  ok: boolean;
  totals?: {
    projects: number;
    tasks: number;
    status: Record<string, number>;
  };
  projects?: ProjectSummary[];
  error?: string;
}

export default function ProjectsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<ProjectsResponse | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/projects/summary');
        if (res.ok) setData(await res.json());
        else setData({ ok: false, error: 'Failed to load projects' });
      } catch {
        setData({ ok: false, error: 'Failed to load projects' });
      }
    };
    run();
  }, []);

  const projects = data?.projects || [];

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="text-sm text-mc-text-secondary">
          {data?.totals ? `${data.totals.projects} projects · ${data.totals.tasks} tasks` : 'Loading…'}
        </p>
      </div>

      {data && !data.ok && (
        <div className="rounded-lg border border-mc-accent-red/40 bg-mc-accent-red/5 p-4 text-sm text-mc-accent-red">
          {data.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => {
          const done = p.counts?.done || p.counts?.completed || 0;
          const total = p.taskCount || 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const inProgress = p.counts?.in_progress || 0;
          const review = p.counts?.review || 0;
          const planning = p.counts?.planning || 0;

          return (
            <Link
              key={p.project}
              href={`/workspace/${slug}?project=${encodeURIComponent(p.project)}`}
              className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4 hover:border-mc-accent/40 hover:shadow-lg hover:shadow-black/20 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold truncate">{p.project}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-mc-bg-tertiary text-mc-text-secondary">
                    {pct}%
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-mc-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="h-2 rounded bg-mc-bg-tertiary overflow-hidden mb-3">
                <div className="h-full bg-mc-accent" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-sm text-mc-text-secondary">{done}/{total} complete</div>
              <div className="mt-2 text-xs text-mc-text-secondary">
                In progress: {inProgress} · Review: {review} · Planning: {planning}
              </div>
              <div className="mt-3 text-xs text-mc-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                View Tasks
              </div>
              {p.error && (
                <div className="mt-2 text-xs text-mc-accent-red">{p.error}</div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
