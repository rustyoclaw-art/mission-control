'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Bot, Loader2, Plus, RefreshCw, Search, Zap, ZapOff } from 'lucide-react';
import { AgentModal } from '@/components/AgentModal';
import { DiscoverAgentsModal } from '@/components/DiscoverAgentsModal';
import { useMissionControl } from '@/lib/store';
import type { Agent, AgentStatus, OpenClawSession } from '@/lib/types';

export default function AgentsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<{ id: string } | null>(null);
  const { agents, tasks, events, updateAgent } = useMissionControl();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; gateway_available: boolean } | null>(null);

  const [agentOpenClawSessions, setAgentOpenClawSessions] = useState<Record<string, OpenClawSession | null>>({});
  const [syncingAgentId, setSyncingAgentId] = useState<string | null>(null);
  const [statusUpdatingAgentId, setStatusUpdatingAgentId] = useState<string | null>(null);
  const [activeSubAgents, setActiveSubAgents] = useState(0);

  // Load workspace
  useEffect(() => {
    fetch(`/api/workspaces/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setWorkspace({ id: data.id }))
      .catch(() => {});
  }, [slug]);

  const refreshAgentSession = useCallback(async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}/openclaw`);
      if (!res.ok) {
        setAgentOpenClawSessions((prev) => ({ ...prev, [agent.id]: null }));
        return;
      }

      const data = await res.json();
      setAgentOpenClawSessions((prev) => ({
        ...prev,
        [agent.id]: data.linked && data.session ? (data.session as OpenClawSession) : null,
      }));
    } catch {
      setAgentOpenClawSessions((prev) => ({ ...prev, [agent.id]: null }));
    }
  }, []);

  useEffect(() => {
    if (agents.length === 0) return;
    const load = async () => {
      await Promise.all(agents.map((agent) => refreshAgentSession(agent)));
    };
    load();
  }, [agents, refreshAgentSession]);

  useEffect(() => {
    const loadSubAgentCount = async () => {
      try {
        const res = await fetch('/api/openclaw/sessions?session_type=subagent&status=active');
        if (!res.ok) return;
        const sessions = await res.json();
        setActiveSubAgents(Array.isArray(sessions) ? sessions.length : 0);
      } catch {
        // no-op
      }
    };

    loadSubAgentCount();
    const timer = setInterval(loadSubAgentCount, 30000);
    return () => clearInterval(timer);
  }, []);

  const taskCountByAgent = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (!task.assigned_agent_id) continue;
      if (task.status === 'done') continue;
      map.set(task.assigned_agent_id, (map.get(task.assigned_agent_id) || 0) + 1);
    }
    return map;
  }, [tasks]);

  const statusCounts = useMemo(() => ({
    working: agents.filter((a) => a.status === 'working').length,
    standby: agents.filter((a) => a.status === 'standby').length,
    offline: agents.filter((a) => a.status === 'offline').length,
  }), [agents]);

  const linkedCount = useMemo(
    () => agents.filter((a) => !!agentOpenClawSessions[a.id]).length,
    [agents, agentOpenClawSessions]
  );

  const forceRefreshFromGateway = useCallback(async () => {
    if (!workspace) return;
    setIsSyncingAll(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/agents/discover?workspace_id=${workspace.id}`);
      if (res.ok) {
        const result = await res.json();
        const discovered = Array.isArray(result) ? result : result?.agents || [];
        setSyncResult({ synced: discovered.length, gateway_available: true });
      } else {
        setSyncResult({ synced: 0, gateway_available: false });
      }
    } catch {
      setSyncResult({ synced: 0, gateway_available: false });
    } finally {
      setIsSyncingAll(false);
    }
  }, [workspace]);

  const updateAgentStatus = async (agent: Agent, status: AgentStatus) => {
    if (agent.status === status) return;
    setStatusUpdatingAgentId(agent.id);

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) return;
      const updated = await res.json();
      updateAgent(updated);
    } catch {
      // no-op
    } finally {
      setStatusUpdatingAgentId(null);
    }
  };

  const toggleOpenClawConnection = async (agent: Agent) => {
    setSyncingAgentId(agent.id);

    try {
      const existingSession = agentOpenClawSessions[agent.id];
      const res = await fetch(`/api/agents/${agent.id}/openclaw`, {
        method: existingSession ? 'DELETE' : 'POST',
      });

      if (res.ok) {
        await refreshAgentSession(agent);
      }
    } catch {
      // no-op
    } finally {
      setSyncingAgentId(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Agent Control Center</h1>
            <p className="text-sm text-mc-text-secondary mt-1">
              Live roster, workload context, and direct controls for every agent in this workspace.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => workspace && setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-mc-bg-tertiary hover:bg-mc-border text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Agent
            </button>
            <button
              onClick={forceRefreshFromGateway}
              disabled={isSyncingAll}
              title="Re-sync all gateway-sourced agents from OpenClaw Gateway"
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-mc-bg-tertiary hover:bg-mc-border text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
              {isSyncingAll ? 'Syncing…' : syncResult
                ? syncResult.gateway_available
                  ? `Synced ${syncResult.synced}`
                  : 'Gateway offline'
                : 'Force refresh'}
            </button>
            <button
              onClick={() => workspace && setShowDiscoverModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-mc-accent/10 hover:bg-mc-accent/20 border border-mc-accent/20 text-mc-accent text-sm"
              title="Optional: inspect available gateway agents before syncing"
            >
              <Search className="w-4 h-4" />
              Discover Gateway Agents
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <StatChip label="Total" value={agents.length} />
          <StatChip label="Working" value={statusCounts.working} tone="working" />
          <StatChip label="Standby" value={statusCounts.standby} tone="standby" />
          <StatChip label="Offline" value={statusCounts.offline} tone="offline" />
          <StatChip label="Active Sub-Agents" value={activeSubAgents} tone={activeSubAgents > 0 ? 'working' : 'standby'} />
        </div>
      </div>

      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-mc-text-secondary">Agent Roster</h2>
          <div className="text-xs text-mc-text-secondary">{linkedCount}/{agents.length} linked to OpenClaw</div>
        </div>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-mc-border p-8 text-center text-mc-text-secondary">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p>No agents yet. Add one or use Force refresh to sync from Gateway.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => {
              const assignedCount = taskCountByAgent.get(agent.id) || 0;
              const session = agentOpenClawSessions[agent.id];
              const isSyncing = syncingAgentId === agent.id;
              const isUpdatingStatus = statusUpdatingAgentId === agent.id;
              const lastEvent = events.find((event) => event.agent_id === agent.id);

              return (
                <div key={agent.id} className="rounded-lg border border-mc-border/70 bg-mc-bg p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{agent.avatar_emoji}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{agent.name}</h3>
                            {agent.is_master ? <span className="text-xs text-mc-accent-yellow">★ master</span> : null}
                            {agent.source === 'gateway' ? <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">GW</span> : null}
                          </div>
                          <p className="text-xs text-mc-text-secondary truncate">{agent.role}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded uppercase ${statusClass(agent.status)}`}>{agent.status}</span>
                        <span className="px-2 py-0.5 rounded bg-mc-bg-tertiary text-mc-text-secondary">{assignedCount} active task{assignedCount !== 1 ? 's' : ''}</span>
                        <span className={`px-2 py-0.5 rounded ${session ? 'bg-green-500/20 text-green-400' : 'bg-mc-bg-tertiary text-mc-text-secondary'}`}>
                          {session ? 'OpenClaw linked' : 'OpenClaw unlinked'}
                        </span>
                        {agent.model ? (
                          <span className="px-2 py-0.5 rounded bg-mc-bg-tertiary text-mc-text-secondary">{agent.model}</span>
                        ) : null}
                      </div>

                      {lastEvent?.message ? (
                        <p className="mt-2 text-xs text-mc-text-secondary line-clamp-1">Latest: {lastEvent.message}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={agent.status}
                        onChange={(e) => updateAgentStatus(agent, e.target.value as AgentStatus)}
                        disabled={isUpdatingStatus}
                        className="px-2 py-1 text-xs rounded border border-mc-border bg-mc-bg-tertiary"
                      >
                        <option value="working">working</option>
                        <option value="standby">standby</option>
                        <option value="offline">offline</option>
                      </select>

                      {agent.is_master ? (
                        <button
                          onClick={() => toggleOpenClawConnection(agent)}
                          disabled={isSyncing}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded transition-colors ${
                            session
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text'
                          }`}
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Syncing...
                            </>
                          ) : session ? (
                            <>
                              <Zap className="w-3 h-3" />
                              Disconnect OpenClaw
                            </>
                          ) : (
                            <>
                              <ZapOff className="w-3 h-3" />
                              Connect OpenClaw
                            </>
                          )}
                        </button>
                      ) : null}

                      <button
                        onClick={() => setEditingAgent(agent)}
                        className="px-2.5 py-1.5 text-xs rounded bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text"
                      >
                        Edit profile
                      </button>

                      <Link
                        href={`/workspace/${slug}`}
                        className="px-2.5 py-1.5 text-xs rounded bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text"
                      >
                        Open task board
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && workspace ? (
        <AgentModal onClose={() => setShowCreateModal(false)} workspaceId={workspace.id} />
      ) : null}

      {editingAgent && workspace ? (
        <AgentModal agent={editingAgent} onClose={() => setEditingAgent(null)} workspaceId={workspace.id} />
      ) : null}

      {showDiscoverModal && workspace ? (
        <DiscoverAgentsModal onClose={() => setShowDiscoverModal(false)} workspaceId={workspace.id} />
      ) : null}
    </div>
  );
}

function StatChip({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'working' | 'standby' | 'offline' }) {
  const toneClass =
    tone === 'working'
      ? 'border-green-500/30 text-green-400'
      : tone === 'standby'
        ? 'border-mc-border text-mc-text-secondary'
        : tone === 'offline'
          ? 'border-mc-accent-red/40 text-mc-accent-red'
          : 'border-mc-border text-mc-text';

  return (
    <div className={`rounded border px-3 py-2 bg-mc-bg ${toneClass}`}>
      <div className="text-xs uppercase tracking-wider text-mc-text-secondary">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function statusClass(status: AgentStatus) {
  if (status === 'working') return 'status-working';
  if (status === 'offline') return 'status-offline';
  return 'status-standby';
}
