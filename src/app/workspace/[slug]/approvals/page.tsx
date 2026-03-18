'use client';

import { useMemo, useState } from 'react';
import { Clock, AlertCircle, ChevronDown, ChevronUp, ArrowUpDown, X } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import type { Task } from '@/lib/types';

const PRIORITY_STYLES = {
  low: { bg: 'bg-mc-text-secondary/20', text: 'text-mc-text-secondary', label: 'Low', weight: 0 },
  normal: { bg: 'bg-mc-accent/20', text: 'text-mc-accent', label: 'Normal', weight: 1 },
  high: { bg: 'bg-mc-accent-yellow/20', text: 'text-mc-accent-yellow', label: 'High', weight: 2 },
  urgent: { bg: 'bg-mc-accent-red/20', text: 'text-mc-accent-red', label: 'Urgent', weight: 3 },
};

const QUICK_REASONS = [
  'Needs more detail',
  'Incorrect approach',
  'Missing tests',
  'Quality issues',
  'Scope mismatch',
];

type SortMode = 'oldest' | 'newest' | 'priority';

export default function ApprovalsPage() {
  const { tasks, setTasks, agents } = useMissionControl();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('mc-approvals-sort') as SortMode) || 'oldest';
    }
    return 'oldest';
  });

  // Return reason modal state
  const [returnTaskId, setReturnTaskId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const reviewTasks = useMemo(() => {
    const filtered = tasks.filter((t) => t.status === 'review');
    return filtered.sort((a, b) => {
      if (sortMode === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortMode === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      // priority: urgent first
      return (PRIORITY_STYLES[b.priority]?.weight ?? 0) - (PRIORITY_STYLES[a.priority]?.weight ?? 0);
    });
  }, [tasks, sortMode]);

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mc-approvals-sort', mode);
    }
  };

  const updateStatus = async (id: string, status: 'done' | 'in_progress', reason?: string) => {
    try {
      setSavingId(id);
      const body: Record<string, string> = { status };
      if (reason) body.status_reason = reason;
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map((t) => (t.id === id ? updated : t)));
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleReturn = async () => {
    if (!returnTaskId || !returnReason.trim()) return;
    await updateStatus(returnTaskId, 'in_progress', returnReason.trim());
    setReturnTaskId(null);
    setReturnReason('');
  };

  const getAgentInfo = (task: Task) => {
    if (task.assigned_agent) {
      const agent = task.assigned_agent as unknown as { name: string; avatar_emoji: string };
      return { name: agent.name, emoji: agent.avatar_emoji };
    }
    if (task.assigned_agent_id) {
      const agent = agents.find(a => a.id === task.assigned_agent_id);
      if (agent) return { name: agent.name, emoji: agent.avatar_emoji };
    }
    return null;
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-3">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Approvals</h1>
            <p className="text-sm text-mc-text-secondary mt-0.5">{reviewTasks.length} tasks waiting for review</p>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-mc-text-secondary" />
            {(['oldest', 'newest', 'priority'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSortChange(mode)}
                className={`px-2.5 py-1 rounded text-xs capitalize ${
                  sortMode === mode
                    ? 'bg-mc-accent/15 text-mc-accent border border-mc-accent/25'
                    : 'text-mc-text-secondary hover:bg-mc-bg-tertiary border border-transparent'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {reviewTasks.map((task) => {
          const priority = PRIORITY_STYLES[task.priority];
          const agentInfo = getAgentInfo(task);
          const isExpanded = expandedId === task.id;

          return (
            <div key={task.id} className="rounded-xl border border-mc-border bg-mc-bg-secondary overflow-hidden">
              <div className="p-4">
                {/* Header with title and priority */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-medium flex-1">{task.title}</div>
                  <span className={`px-2 py-0.5 text-xs rounded font-medium ${priority.bg} ${priority.text}`}>
                    {priority.label}
                  </span>
                </div>

                {/* Description preview */}
                {task.description && (
                  <div className="text-sm text-mc-text-secondary mt-1 line-clamp-2">{task.description}</div>
                )}

                {/* Context row: agent, created date, last activity */}
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-mc-text-secondary">
                  {agentInfo && (
                    <div className="flex items-center gap-1.5 bg-mc-bg-tertiary px-2 py-1 rounded">
                      <span>{agentInfo.emoji}</span>
                      <span>{agentInfo.name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
                  </div>

                  {task.updated_at !== task.created_at && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Updated {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>

                {/* Expand/collapse for full details */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                  className="flex items-center gap-1 mt-3 text-xs text-mc-text-secondary hover:text-mc-text"
                >
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {isExpanded ? 'Hide details' : 'View full details'}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-mc-border space-y-2">
                    {task.description && (
                      <div>
                        <div className="text-xs font-medium text-mc-text-secondary mb-1">Full Description</div>
                        <p className="text-sm text-mc-text whitespace-pre-wrap">{task.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-mc-text-secondary">Task ID:</span>
                        <span className="ml-1 font-mono">{task.id.slice(0, 8)}</span>
                      </div>
                      <div>
                        <span className="text-mc-text-secondary">Status:</span>
                        <span className="ml-1 capitalize">{task.status}</span>
                      </div>
                      {task.due_date && (
                        <div>
                          <span className="text-mc-text-secondary">Due:</span>
                          <span className="ml-1">{new Date(task.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(task.id, 'done')}
                    disabled={savingId === task.id}
                    className="px-4 py-2 rounded-lg bg-mc-accent-green/20 text-mc-accent-green font-medium hover:bg-mc-accent-green/30 disabled:opacity-50 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setReturnTaskId(task.id);
                      setReturnReason('');
                    }}
                    disabled={savingId === task.id}
                    className="px-4 py-2 rounded-lg bg-mc-accent-yellow/20 text-mc-accent-yellow font-medium hover:bg-mc-accent-yellow/30 disabled:opacity-50 transition-colors"
                  >
                    Return
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {reviewTasks.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-mc-text-secondary">No items in review</div>
            <p className="text-sm text-mc-text-secondary/60 mt-1">Tasks will appear here when they reach the review stage</p>
          </div>
        )}
      </div>

      {/* Return reason modal */}
      {returnTaskId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setReturnTaskId(null)}>
          <div
            className="w-full max-w-md bg-mc-bg-secondary border border-mc-border rounded-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Return Task</h3>
              <button onClick={() => setReturnTaskId(null)} className="p-1 hover:bg-mc-bg-tertiary rounded">
                <X className="w-4 h-4 text-mc-text-secondary" />
              </button>
            </div>
            <p className="text-sm text-mc-text-secondary">
              Provide a reason so the agent knows what to fix.
            </p>

            {/* Quick-select reasons */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setReturnReason(reason)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    returnReason === reason
                      ? 'bg-mc-accent-yellow/15 text-mc-accent-yellow border-mc-accent-yellow/25'
                      : 'text-mc-text-secondary border-mc-border hover:border-mc-accent-yellow/25'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              placeholder="Describe what needs to be fixed..."
              className="w-full bg-mc-bg border border-mc-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mc-accent/50 resize-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setReturnTaskId(null)}
                className="px-4 py-2 text-sm text-mc-text-secondary hover:text-mc-text"
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={!returnReason.trim() || savingId === returnTaskId}
                className="px-4 py-2 rounded-lg bg-mc-accent-yellow/20 text-mc-accent-yellow font-medium hover:bg-mc-accent-yellow/30 disabled:opacity-50 transition-colors"
              >
                Return with Reason
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
