'use client';

import { useMemo, useState } from 'react';
import { Clock, User, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import type { Task } from '@/lib/types';

const PRIORITY_STYLES = {
  low: { bg: 'bg-mc-text-secondary/20', text: 'text-mc-text-secondary', label: 'Low' },
  normal: { bg: 'bg-mc-accent/20', text: 'text-mc-accent', label: 'Normal' },
  high: { bg: 'bg-mc-accent-yellow/20', text: 'text-mc-accent-yellow', label: 'High' },
  urgent: { bg: 'bg-mc-accent-red/20', text: 'text-mc-accent-red', label: 'Urgent' },
};

export default function ApprovalsPage() {
  const { tasks, setTasks, agents } = useMissionControl();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const reviewTasks = useMemo(() =>
    tasks
      .filter((t) => t.status === 'review')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), // Oldest first
    [tasks]
  );

  const updateStatus = async (id: string, status: 'done' | 'in_progress') => {
    try {
      setSavingId(id);
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map((t) => (t.id === id ? updated : t)));
      }
    } finally {
      setSavingId(null);
    }
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
      <div>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-mc-text-secondary">{reviewTasks.length} tasks waiting for review</p>
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
                  {/* Assigned Agent */}
                  {agentInfo && (
                    <div className="flex items-center gap-1.5 bg-mc-bg-tertiary px-2 py-1 rounded">
                      <span>{agentInfo.emoji}</span>
                      <span>{agentInfo.name}</span>
                    </div>
                  )}

                  {/* Created date */}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
                  </div>

                  {/* Last activity */}
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
                    onClick={() => updateStatus(task.id, 'in_progress')}
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
    </div>
  );
}
