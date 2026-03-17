'use client';

import { useEffect, useState } from 'react';

type PipelineRun = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type PipelineRunStage = {
  id: string;
  stage_label: string;
  status: string;
  decision: string;
  assigned_agent_name?: string | null;
  task_id?: string | null;
  task_title?: string | null;
  task_status?: string | null;
  task_description?: string | null;
};

type RunDetails = {
  run: PipelineRun;
  stages: PipelineRunStage[];
  timeline?: {
    total_events: number;
    by_type: Record<string, number>;
  };
};

interface PipelineRunPanelProps {
  workspaceId?: string;
}

export function PipelineRunPanel({ workspaceId }: PipelineRunPanelProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  const refreshRuns = async () => {
    if (!workspaceId) return;
    const res = await fetch(`/api/pipelines/runs?workspace_id=${workspaceId}&limit=15`);
    if (!res.ok) throw new Error('Failed to fetch runs');
    const data: PipelineRun[] = await res.json();
    setRuns(data);
    if (!selectedRunId && data.length > 0) {
      setSelectedRunId(data[0].id);
    }
  };

  const refreshDetails = async (runId: string) => {
    const res = await fetch(`/api/pipelines/runs/${runId}`);
    if (!res.ok) throw new Error('Failed to fetch run details');
    const data = await res.json();
    setDetails(data);
  };

  useEffect(() => {
    refreshRuns().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (!selectedRunId) return;
    setLoading(true);
    setError(null);
    refreshDetails(selectedRunId)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedRunId]);

  const post = async (path: string, body?: Record<string, unknown>) => {
    if (!details?.run.id) return;
    setActionLoading(path);
    setError(null);
    try {
      const res = await fetch(`/api/pipelines/runs/${details.run.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Action failed');
      }
      await refreshRuns();
      await refreshDetails(details.run.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setActionLoading(null);
    }
  };

  const firstPendingStage = details?.stages.find((s) => s.status === 'pending' || s.status === 'running');

  return (
    <div className="mx-3 mt-3 p-3 border border-mc-border rounded bg-mc-bg-secondary">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-mc-text-secondary">Pipeline Run Controls</p>
          <p className="text-sm font-medium">Run details and stage controls</p>
        </div>
        <select
          value={selectedRunId}
          onChange={(e) => setSelectedRunId(e.target.value)}
          className="bg-mc-bg border border-mc-border rounded px-2 py-1 text-xs"
        >
          <option value="">Select run...</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.title} · {run.status}</option>
          ))}
        </select>
      </div>

      {error && <div className="mt-2 text-xs text-mc-accent-red">{error}</div>}

      {loading && <div className="mt-2 text-xs text-mc-text-secondary">Loading run details...</div>}

      {details && (
        <>
          <div className="mt-3 text-xs text-mc-text-secondary">
            <span className="font-mono">{details.run.id}</span> · status <span className="text-mc-text">{details.run.status}</span>
            {details.timeline && <span> · events {details.timeline.total_events}</span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => post('advance')}
              disabled={actionLoading !== null}
              className="px-2 py-1 text-xs rounded bg-mc-accent text-mc-bg disabled:opacity-50"
            >
              {actionLoading === 'advance' ? 'Advancing...' : 'Advance'}
            </button>
            <button
              type="button"
              onClick={() => post('retry-stage', firstPendingStage ? { stage_id: firstPendingStage.id } : {})}
              disabled={actionLoading !== null || !firstPendingStage}
              className="px-2 py-1 text-xs rounded bg-mc-accent-yellow text-mc-bg disabled:opacity-50"
            >
              {actionLoading === 'retry-stage' ? 'Retrying...' : 'Retry Stage'}
            </button>
            <button
              type="button"
              onClick={() => post('cancel')}
              disabled={actionLoading !== null || details.run.status === 'cancelled' || details.run.status === 'completed'}
              className="px-2 py-1 text-xs rounded bg-mc-accent-red text-white disabled:opacity-50"
            >
              {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Run'}
            </button>
          </div>

          <div className="mt-3 space-y-1.5 max-h-64 overflow-auto pr-1">
            {details.stages.map((stage) => {
              const stageStatusColor = stage.status === 'completed' ? 'text-mc-accent-green' : stage.status === 'running' ? 'text-mc-accent' : stage.status === 'failed' ? 'text-mc-accent-red' : 'text-mc-text-secondary';
              const taskStatusColor = stage.task_status === 'done' ? 'bg-mc-accent-green/20 text-mc-accent-green' : stage.task_status === 'in_progress' ? 'bg-mc-accent/20 text-mc-accent' : stage.task_status === 'review' ? 'bg-mc-accent-purple/20 text-mc-accent-purple' : 'bg-mc-bg-tertiary text-mc-text-secondary';
              const isExpanded = expandedStageId === stage.id;
              const isBlockedStage = stage.status === 'failed' || (stage.task_status && ['testing', 'review'].includes(stage.task_status));

              return (
                <div key={stage.id} className={`text-xs rounded bg-mc-bg border ${isBlockedStage ? 'border-mc-accent-red/30' : 'border-mc-border/60'}`}>
                  <div
                    className="p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-mc-bg-tertiary/30"
                    onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium truncate">{stage.stage_label}</span>
                      <span className={`flex-shrink-0 ${stageStatusColor}`}>{stage.status}</span>
                      {stage.task_status && (
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] ${taskStatusColor}`}>
                          {stage.task_status}
                        </span>
                      )}
                      {isBlockedStage && <span className="text-mc-accent-red">!</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {stage.assigned_agent_name && (
                        <span className="text-mc-text-secondary">{stage.assigned_agent_name}</span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); post('retry-stage', { stage_id: stage.id }); }}
                        disabled={actionLoading !== null}
                        className="px-2 py-0.5 rounded border border-mc-border hover:bg-mc-bg-tertiary"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 pt-0 border-t border-mc-border/30 space-y-1.5">
                      {stage.task_title && (
                        <div className="pt-1.5">
                          <span className="text-mc-text-secondary">Task:</span>{' '}
                          <span className="text-mc-text">{stage.task_title}</span>
                        </div>
                      )}
                      {stage.task_description && (
                        <div className="text-mc-text-secondary line-clamp-3">{stage.task_description}</div>
                      )}
                      <div className="flex items-center gap-3 text-mc-text-secondary">
                        <span>Decision: {stage.decision}</span>
                        {stage.task_id && <span className="font-mono">{stage.task_id.slice(0, 8)}</span>}
                      </div>
                      {stage.status === 'completed' && (
                        <div className="flex items-center gap-1 text-mc-accent-green">
                          <span>Stage complete</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
