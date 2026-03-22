'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useMissionControl } from '@/lib/store';
import type { TaskStatus } from '@/lib/types';

interface WorkstreamPageProps {
  title: string;
  description: string;
  keywordHints?: string[];
  focusStatuses?: TaskStatus[];
}

export function WorkstreamPage({
  title,
  description,
  keywordHints = [],
  focusStatuses = ['inbox', 'assigned', 'in_progress', 'testing', 'review'],
}: WorkstreamPageProps) {
  const { tasks } = useMissionControl();
  const params = useParams();
  const slug = params.slug as string;

  const scoped = useMemo(() => {
    const byStatus = tasks.filter((t) => focusStatuses.includes(t.status));
    if (keywordHints.length === 0) return byStatus.slice(0, 10);

    const hints = keywordHints.map((k) => k.toLowerCase());
    return byStatus
      .filter((t) => {
        const hay = `${t.title} ${t.description || ''}`.toLowerCase();
        return hints.some((h) => hay.includes(h));
      })
      .slice(0, 10);
  }, [tasks, focusStatuses, keywordHints]);

  const activeCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-mc-text-secondary mt-1">{description}</p>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-mc-bg-tertiary text-mc-text-secondary">{activeCount} active tasks</span>
          <span className="px-2 py-1 rounded bg-mc-accent/10 text-mc-accent">{scoped.length} in this workstream</span>
        </div>
      </div>

      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Workstream queue</h2>
          <Link
            href={`/workspace/${slug}`}
            className="text-xs px-2 py-1 rounded bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text"
          >
            Open full task board
          </Link>
        </div>

        {scoped.length === 0 ? (
          <div className="text-sm text-mc-text-secondary">
            No matching tasks yet. Create or retag tasks in the main board to populate this page.
          </div>
        ) : (
          <div className="space-y-2">
            {scoped.map((task) => (
              <div key={task.id} className="rounded border border-mc-border/60 bg-mc-bg-tertiary p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-sm">{task.title}</div>
                  <span className="text-xs text-mc-text-secondary">{task.status}</span>
                </div>
                {task.description && (
                  <div className="mt-1 text-xs text-mc-text-secondary line-clamp-2">{task.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
