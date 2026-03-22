'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Rocket, X } from 'lucide-react';
import { PipelineRunPanel } from '@/components/PipelineRunPanel';
import type { TaskPriority } from '@/lib/types';

type LaunchSummary = {
  runId: string;
  stagesCreated: number;
  warningsCount: number;
};

export default function PipelinePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<{ id: string } | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchSummary, setLaunchSummary] = useState<LaunchSummary | null>(null);

  useEffect(() => {
    fetch(`/api/workspaces/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setWorkspace({ id: data.id }))
      .catch(() => {});
  }, [slug]);

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Pipeline Operations</h1>
            <p className="text-sm text-mc-text-secondary mt-1">
              Monitor live pipeline runs, advance/retry/cancel stages, and launch new runs from one operator surface.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLaunchModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90"
            >
              <Rocket className="w-4 h-4" />
              Launch Pipeline
            </button>
            <Link
              href={`/workspace/${slug}`}
              className="px-3 py-1.5 rounded text-sm border border-mc-border bg-mc-bg hover:bg-mc-bg-tertiary"
            >
              Open Task Board
            </Link>
          </div>
        </div>
      </div>

      {launchSummary && (
        <div className="p-3 bg-mc-accent-green/10 border border-mc-accent-green/30 rounded text-sm flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-mc-accent-green">Pipeline launched</p>
            <p className="text-mc-text-secondary mt-1">
              Run <span className="font-mono text-xs">{launchSummary.runId}</span> · {launchSummary.stagesCreated} stages created · {launchSummary.warningsCount} warnings
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLaunchSummary(null)}
            className="p-1 hover:bg-mc-bg-tertiary rounded"
          >
            <X className="w-4 h-4 text-mc-text-secondary" />
          </button>
        </div>
      )}

      {workspace && <PipelineRunPanel workspaceId={workspace.id} />}

      {showLaunchModal && workspace && (
        <LaunchPipelineModal
          workspaceId={workspace.id}
          onClose={() => setShowLaunchModal(false)}
          onLaunched={(summary) => {
            setLaunchSummary(summary);
            setShowLaunchModal(false);
          }}
        />
      )}
    </div>
  );
}

interface LaunchPipelineModalProps {
  workspaceId?: string;
  onClose: () => void;
  onLaunched: (summary: LaunchSummary) => Promise<void> | void;
}

function LaunchPipelineModal({ workspaceId, onClose, onLaunched }: LaunchPipelineModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normal' as TaskPriority,
    high_risk: false,
    workspace_id: workspaceId || 'default',
  });

  const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/pipelines/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          high_risk: form.high_risk,
          workspace_id: form.workspace_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data?.details)
          ? ` (${data.details.map((d: { message?: string }) => d.message).filter(Boolean).join(', ')})`
          : '';
        setError((data?.error || 'Failed to launch pipeline') + details);
        return;
      }

      await onLaunched({
        runId: data.run?.id || 'unknown',
        stagesCreated: Array.isArray(data.stages) ? data.stages.filter((s: { status?: string }) => s.status !== 'skipped').length : 0,
        warningsCount: Array.isArray(data.warnings) ? data.warnings.length : 0,
      });
    } catch (err) {
      console.error('Failed to launch pipeline:', err);
      setError('Failed to launch pipeline. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-mc-border">
          <h2 className="text-lg font-semibold">Launch Pipeline</h2>
          <button onClick={onClose} className="p-1 hover:bg-mc-bg-tertiary rounded" disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
              placeholder="Pipeline title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent resize-none"
              placeholder="Optional context for all generated stage tasks"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Workspace ID</label>
              <input
                type="text"
                value={form.workspace_id}
                readOnly
                className="w-full bg-mc-bg-tertiary border border-mc-border rounded px-3 py-2 text-sm text-mc-text-secondary"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 p-3 bg-mc-bg rounded border border-mc-border cursor-pointer">
            <input
              type="checkbox"
              checked={form.high_risk}
              onChange={(e) => setForm({ ...form, high_risk: e.target.checked })}
              className="w-4 h-4 rounded border-mc-border"
            />
            <span className="text-sm">High risk (enables optional red-team stage)</span>
          </label>

          {error && (
            <div className="p-3 bg-mc-accent-red/10 border border-mc-accent-red/30 rounded text-sm text-mc-accent-red">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-mc-border">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-mc-text-secondary hover:text-mc-text disabled:opacity-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
            >
              <Rocket className="w-4 h-4" />
              {isSubmitting ? 'Launching...' : 'Launch Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
