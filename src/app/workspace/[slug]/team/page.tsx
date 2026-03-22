'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Terminal,
  Users,
  Zap,
  ZapOff,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent, Task, OpenClawSession, AgentStatus } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentWithMeta = Agent & {
  activeTasks: Task[];
  session: OpenClawSession | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '—';
  }
}

function StatusDot({ status }: { status: AgentStatus }) {
  const cls =
    status === 'working'
      ? 'bg-mc-accent animate-pulse'
      : status === 'offline'
      ? 'bg-mc-accent-red'
      : 'bg-mc-text-secondary/40';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function StatusBadge({ status }: { status: AgentStatus }) {
  if (status === 'working')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-accent/20 text-mc-accent">
        <Zap className="w-2.5 h-2.5" />
        working
      </span>
    );
  if (status === 'offline')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-accent-red/20 text-mc-accent-red">
        <ZapOff className="w-2.5 h-2.5" />
        offline
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase bg-mc-bg-tertiary text-mc-text-secondary">
      <Activity className="w-2.5 h-2.5" />
      standby
    </span>
  );
}

// ─── StatusControl ────────────────────────────────────────────────────────────

function StatusControl({
  agent,
  onStatusChange,
  updating,
}: {
  agent: Agent;
  onStatusChange: (id: string, status: AgentStatus) => void;
  updating: boolean;
}) {
  const options: AgentStatus[] = ['working', 'standby', 'offline'];
  return (
    <div className="flex items-center gap-1">
      {options.map((s) => (
        <button
          key={s}
          onClick={(e) => {
            e.stopPropagation();
            if (agent.status !== s) onStatusChange(agent.id, s);
          }}
          disabled={updating || agent.status === s}
          title={`Set ${agent.name} to ${s}`}
          className={`px-2 py-0.5 rounded text-[10px] uppercase transition-colors ${
            agent.status === s
              ? s === 'working'
                ? 'bg-mc-accent/25 text-mc-accent cursor-default'
                : s === 'offline'
                ? 'bg-mc-accent-red/25 text-mc-accent-red cursor-default'
                : 'bg-mc-bg-tertiary text-mc-text-secondary cursor-default'
              : 'bg-mc-bg border border-mc-border/60 text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/30 disabled:opacity-40'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── TaskReassignModal ────────────────────────────────────────────────────────

function TaskReassignModal({
  task,
  agents,
  onClose,
  onReassign,
}: {
  task: Task;
  agents: Agent[];
  onClose: () => void;
  onReassign: (taskId: string, agentId: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(task.assigned_agent_id);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onReassign(task.id, selected);
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-mc-border bg-mc-bg-secondary shadow-2xl w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-1">Reassign Task</h3>
        <p className="text-xs text-mc-text-secondary mb-4 truncate">{task.title}</p>

        <div className="space-y-1.5 max-h-64 overflow-y-auto mb-4">
          <button
            onClick={() => setSelected(null)}
            className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
              selected === null
                ? 'border-mc-accent/50 bg-mc-accent/10 text-mc-text'
                : 'border-mc-border bg-mc-bg hover:border-mc-accent/30'
            }`}
          >
            <span className="text-mc-text-secondary">— Unassign</span>
          </button>
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`w-full text-left px-3 py-2 rounded border text-xs flex items-center gap-2 transition-colors ${
                selected === a.id
                  ? 'border-mc-accent/50 bg-mc-accent/10 text-mc-text'
                  : 'border-mc-border bg-mc-bg hover:border-mc-accent/30'
              }`}
            >
              <span>{a.avatar_emoji || '🤖'}</span>
              <span className="font-medium">{a.name}</span>
              <StatusDot status={a.status} />
              <span className="ml-auto text-mc-text-secondary/60">{a.role}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-mc-border text-xs text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || selected === task.assigned_agent_id}
            className="px-3 py-1.5 rounded border border-mc-accent/50 bg-mc-accent/10 text-mc-accent text-xs hover:bg-mc-accent/20 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

function AgentCard({
  agentMeta,
  allAgents,
  onStatusChange,
  onReassign,
  updatingId,
}: {
  agentMeta: AgentWithMeta;
  allAgents: Agent[];
  onStatusChange: (id: string, status: AgentStatus) => void;
  onReassign: (taskId: string, agentId: string | null) => void;
  updatingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const { activeTasks, session } = agentMeta;
  const updating = updatingId === agentMeta.id;

  return (
    <>
      <div
        className={`rounded-lg border transition-colors ${
          agentMeta.status === 'working'
            ? 'border-mc-accent/30 bg-mc-accent/5'
            : agentMeta.status === 'offline'
            ? 'border-mc-accent-red/20 bg-mc-accent-red/5'
            : 'border-mc-border bg-mc-bg-secondary'
        }`}
      >
        <div
          className="flex items-start justify-between gap-3 p-3 cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl flex-shrink-0">{agentMeta.avatar_emoji || '🤖'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{agentMeta.name}</span>
                {agentMeta.is_master && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-mc-accent-purple/20 text-mc-accent-purple uppercase tracking-wider flex-shrink-0">
                    master
                  </span>
                )}
              </div>
              <div className="text-xs text-mc-text-secondary truncate">{agentMeta.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={agentMeta.status} />
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-mc-text-secondary" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-mc-text-secondary" />
            )}
          </div>
        </div>

        <div className="px-3 pb-2 flex items-center gap-3 text-xs text-mc-text-secondary">
          <span>{activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''}</span>
          {session && (
            <>
              <span className="text-mc-border">·</span>
              <span className="flex items-center gap-1">
                <Terminal className="w-3 h-3" />
                session active
              </span>
            </>
          )}
          {agentMeta.model && (
            <>
              <span className="text-mc-border">·</span>
              <span className="font-mono text-[10px]">{agentMeta.model}</span>
            </>
          )}
        </div>

        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          <StatusControl
            agent={agentMeta}
            onStatusChange={onStatusChange}
            updating={updating}
          />
          {updating && (
            <div className="mt-1.5 text-[10px] text-mc-text-secondary flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Updating status…
            </div>
          )}
        </div>

        {expanded && (
          <div className="border-t border-mc-border/40 px-3 py-3 space-y-3">
            {session && (
              <div className="rounded border border-mc-border/40 bg-mc-bg p-2.5 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1.5 flex items-center gap-1">
                  <Terminal className="w-3 h-3" />
                  Active Session
                </div>
                <div className="space-y-0.5">
                  <div className="flex gap-2">
                    <span className="text-mc-text-secondary w-16 flex-shrink-0">ID</span>
                    <span className="font-mono text-[10px] truncate">{session.openclaw_session_id}</span>
                  </div>
                  {session.channel && (
                    <div className="flex gap-2">
                      <span className="text-mc-text-secondary w-16 flex-shrink-0">Channel</span>
                      <span className="font-mono text-[10px]">{session.channel}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-mc-text-secondary w-16 flex-shrink-0">Type</span>
                    <span>{session.session_type}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-mc-text-secondary w-16 flex-shrink-0">Status</span>
                    <span>{session.status}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-mc-text-secondary w-16 flex-shrink-0">Started</span>
                    <span>{fmtTs(session.created_at)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTasks.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-2">
                  Active Tasks ({activeTasks.length})
                </div>
                <div className="space-y-1.5">
                  {activeTasks.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      className="rounded border border-mc-border/40 bg-mc-bg p-2 text-xs flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-mc-text-secondary/70 capitalize mt-0.5">
                          {t.status} · {t.priority}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReassignTask(t);
                        }}
                        className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded border border-mc-border/60 text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/30 transition-colors"
                      >
                        Reassign
                      </button>
                    </div>
                  ))}
                  {activeTasks.length > 5 && (
                    <div className="text-[11px] text-mc-text-secondary/60">
                      +{activeTasks.length - 5} more tasks
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTasks.length === 0 && !session && (
              <div className="text-xs text-mc-text-secondary/60 py-1">No active tasks or sessions</div>
            )}

            {agentMeta.description && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1">Description</div>
                <div className="text-xs text-mc-text-secondary">{agentMeta.description}</div>
              </div>
            )}

            {agentMeta.gateway_agent_id && (
              <div className="text-[10px] text-mc-text-secondary/50 flex gap-2">
                <span className="uppercase tracking-wider">Gateway ID</span>
                <span className="font-mono">{agentMeta.gateway_agent_id}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {reassignTask && (
        <TaskReassignModal
          task={reassignTask}
          agents={allAgents.filter((a) => a.id !== agentMeta.id)}
          onClose={() => setReassignTask(null)}
          onReassign={onReassign}
        />
      )}
    </>
  );
}

// ─── WorkloadBar ──────────────────────────────────────────────────────────────

function WorkloadBar({ agents, tasks }: { agents: Agent[]; tasks: Task[] }) {
  const rows = useMemo(() => {
    return agents
      .map((a) => {
        const count = tasks.filter(
          (t) => t.assigned_agent_id === a.id && t.status !== 'done'
        ).length;
        return { agent: a, count };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [agents, tasks]);

  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5" />
        Workload Distribution
      </h3>
      <div className="space-y-2">
        {rows.map(({ agent, count }) => (
          <div key={agent.id} className="flex items-center gap-3 text-xs">
            <span className="w-5 text-center">{agent.avatar_emoji || '🤖'}</span>
            <span className="w-24 truncate text-mc-text-secondary">{agent.name}</span>
            <div className="flex-1 h-2 rounded-full bg-mc-bg-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-mc-accent/60 transition-all duration-500"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right text-mc-text-secondary/70">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SessionsPanel ────────────────────────────────────────────────────────────

function SessionsPanel({ sessions }: { sessions: OpenClawSession[] }) {
  const active = sessions.filter((s) => !s.ended_at);

  return (
    <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3 flex items-center gap-2">
        <Terminal className="w-3.5 h-3.5" />
        Live Sessions
        {active.length > 0 && (
          <span className="ml-auto bg-mc-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {active.length}
          </span>
        )}
      </h3>
      {sessions.length === 0 ? (
        <div className="text-xs text-mc-text-secondary/60 py-2">No sessions found</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {sessions.slice(0, 12).map((s) => (
            <div
              key={s.id}
              className={`rounded border p-2 text-xs ${
                !s.ended_at
                  ? 'border-mc-accent/30 bg-mc-accent/5'
                  : 'border-mc-border/40 bg-mc-bg'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-[10px] truncate text-mc-text-secondary">
                  {s.openclaw_session_id}
                </span>
                <span
                  className={`text-[10px] flex-shrink-0 ${
                    !s.ended_at ? 'text-mc-accent' : 'text-mc-text-secondary/50'
                  }`}
                >
                  {!s.ended_at ? '● live' : '○ ended'}
                </span>
              </div>
              <div className="flex gap-3 text-mc-text-secondary/70">
                <span>{s.session_type}</span>
                {s.channel && <span className="font-mono">{s.channel}</span>}
                <span className="ml-auto">{fmtTs(s.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<{ id: string } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<OpenClawSession[]>([]);
  const [agentSessions, setAgentSessions] = useState<Record<string, OpenClawSession | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AgentStatus | 'all'>('all');

  // Load workspace first
  useEffect(() => {
    fetch(`/api/workspaces/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setWorkspace({ id: data.id }))
      .catch(() => {});
  }, [slug]);

  const loadData = useCallback(async (silent = false) => {
    if (!workspace) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [agentsRes, tasksRes, sessionsRes] = await Promise.all([
        fetch(`/api/agents?workspace_id=${workspace.id}`),
        fetch(`/api/tasks?workspace_id=${workspace.id}`),
        fetch('/api/openclaw/sessions?session_type=persistent'),
      ]);

      const [agentsBody, tasksBody, sessionsBody] = await Promise.all([
        agentsRes.json(),
        tasksRes.json(),
        sessionsRes.ok ? sessionsRes.json() : [],
      ]);

      const agentList: Agent[] = Array.isArray(agentsBody) ? agentsBody : [];
      const taskList: Task[] = Array.isArray(tasksBody) ? tasksBody : [];
      const sessionList: OpenClawSession[] = Array.isArray(sessionsBody)
        ? sessionsBody
        : Array.isArray(sessionsBody?.sessions)
        ? sessionsBody.sessions
        : [];

      setAgents(agentList);
      setTasks(taskList);
      setSessions(sessionList);

      const sessionMap: Record<string, OpenClawSession | null> = {};
      await Promise.all(
        agentList.map(async (agent) => {
          try {
            const res = await fetch(`/api/agents/${agent.id}/openclaw`);
            if (!res.ok) { sessionMap[agent.id] = null; return; }
            const data = await res.json();
            sessionMap[agent.id] = data.linked && data.session ? data.session : null;
          } catch {
            sessionMap[agent.id] = null;
          }
        })
      );
      setAgentSessions(sessionMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    loadData();
    const timer = setInterval(() => loadData(true), 30000);
    return () => clearInterval(timer);
  }, [workspace, loadData]);

  const handleStatusChange = useCallback(
    async (agentId: string, status: AgentStatus) => {
      setActionError(null);
      setUpdatingAgentId(agentId);
      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const body = await res.json();
        if (!res.ok) {
          setActionError(body?.error || 'Failed to update agent status');
          return;
        }
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, status } : a))
        );
      } finally {
        setUpdatingAgentId(null);
      }
    },
    []
  );

  const handleReassign = useCallback(
    async (taskId: string, agentId: string | null) => {
      setActionError(null);
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_agent_id: agentId }),
        });
        const body = await res.json();
        if (!res.ok) {
          setActionError(body?.error || 'Failed to reassign task');
          return;
        }
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, assigned_agent_id: agentId } : t
          )
        );
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Failed to reassign task');
      }
    },
    []
  );

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);

  const agentsWithMeta: AgentWithMeta[] = useMemo(() => {
    return agents.map((a) => ({
      ...a,
      activeTasks: activeTasks.filter((t) => t.assigned_agent_id === a.id),
      session: agentSessions[a.id] ?? null,
    }));
  }, [agents, activeTasks, agentSessions]);

  const stats = useMemo(() => ({
    total: agents.length,
    working: agents.filter((a) => a.status === 'working').length,
    standby: agents.filter((a) => a.status === 'standby').length,
    offline: agents.filter((a) => a.status === 'offline').length,
    activeTasks: activeTasks.length,
    unassigned: activeTasks.filter((t) => !t.assigned_agent_id).length,
  }), [agents, activeTasks]);

  const filteredAgents = useMemo(() => {
    if (filterStatus === 'all') return agentsWithMeta;
    return agentsWithMeta.filter((a) => a.status === filterStatus);
  }, [agentsWithMeta, filterStatus]);

  const statusFilters: { key: AgentStatus | 'all'; label: string }[] = [
    { key: 'all', label: `All (${stats.total})` },
    { key: 'working', label: `Working (${stats.working})` },
    { key: 'standby', label: `Standby (${stats.standby})` },
    { key: 'offline', label: `Offline (${stats.offline})` },
  ];

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-mc-accent" />
              Team Operations
            </h1>
            <p className="text-sm text-mc-text-secondary mt-0.5">
              Live agent org state — control status, inspect sessions, reassign work
            </p>
          </div>
          <button
            onClick={() => loadData(false)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-mc-border text-xs text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
          {[
            { label: 'Agents', value: stats.total, color: 'text-mc-text' },
            { label: 'Working', value: stats.working, color: 'text-mc-accent' },
            { label: 'Standby', value: stats.standby, color: 'text-mc-text-secondary' },
            { label: 'Offline', value: stats.offline, color: 'text-mc-accent-red' },
            { label: 'Active Tasks', value: stats.activeTasks, color: 'text-mc-accent-green' },
            { label: 'Unassigned', value: stats.unassigned, color: stats.unassigned > 0 ? 'text-mc-accent-yellow' : 'text-mc-text-secondary' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded border border-mc-border bg-mc-bg p-2.5 text-center">
              <div className={`text-lg font-bold ${color}`}>{loading ? '…' : value}</div>
              <div className="text-[10px] text-mc-text-secondary mt-0.5 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {actionError && (
          <div className="mt-3 flex items-center gap-2 rounded border border-mc-accent-red/40 bg-mc-accent-red/10 px-3 py-2 text-xs text-mc-accent-red">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {actionError}
            <button onClick={() => setActionError(null)} className="ml-auto text-mc-accent-red/60 hover:text-mc-accent-red">✕</button>
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-mc-accent-red/40 bg-mc-accent-red/5 p-6 text-center">
          <AlertCircle className="w-5 h-5 text-mc-accent-red mx-auto mb-2" />
          <p className="text-sm text-mc-accent-red">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-mc-text-secondary gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading team…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusFilters.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    filterStatus === key
                      ? 'bg-mc-accent/20 text-mc-accent border border-mc-accent/30'
                      : 'bg-mc-bg-secondary border border-mc-border text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredAgents.length === 0 ? (
              <div className="rounded-lg border border-mc-border bg-mc-bg-secondary py-12 text-center">
                <Bot className="w-8 h-8 text-mc-text-secondary/40 mx-auto mb-2" />
                <p className="text-sm text-mc-text-secondary">
                  {agents.length === 0
                    ? 'No agents found. Import agents from the Agents page.'
                    : 'No agents match the current filter.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAgents.map((a) => (
                  <AgentCard
                    key={a.id}
                    agentMeta={a}
                    allAgents={agents}
                    onStatusChange={handleStatusChange}
                    onReassign={handleReassign}
                    updatingId={updatingAgentId}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <WorkloadBar agents={agents} tasks={tasks} />
            <SessionsPanel sessions={sessions} />
          </div>
        </div>
      )}
    </div>
  );
}
