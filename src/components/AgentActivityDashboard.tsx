'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Activity, Clock, Filter, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent, Event, Task, Workspace } from '@/lib/types';

type ActivityFilter = 'all' | 'working' | 'blocked' | 'idle';

interface AgentActivityDashboardProps {
  workspace?: Workspace | null;
}

export function AgentActivityDashboard({ workspace }: AgentActivityDashboardProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [isPortrait, setIsPortrait] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const workspaceId = workspace?.id;

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    const update = () => setIsPortrait(media.matches);
    update();
    media.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [agentsRes, tasksRes, eventsRes] = await Promise.all([
          fetch(workspaceId ? `/api/agents?workspace_id=${workspaceId}` : '/api/agents'),
          fetch(workspaceId ? `/api/tasks?workspace_id=${workspaceId}` : '/api/tasks'),
          fetch('/api/events?limit=150'),
        ]);

        if (!mounted) return;

        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } catch (error) {
        console.error('Failed to load activity dashboard data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const [agentsRes, tasksRes, eventsRes] = await Promise.all([
          fetch(workspaceId ? `/api/agents?workspace_id=${workspaceId}` : '/api/agents'),
          fetch(workspaceId ? `/api/tasks?workspace_id=${workspaceId}` : '/api/tasks'),
          fetch('/api/events?limit=150'),
        ]);

        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } catch (error) {
        console.error('Failed to refresh activity dashboard data:', error);
      }
    };

    const startPolling = () => {
      if (pollingIntervalRef.current) return;
      pollingIntervalRef.current = setInterval(refresh, 20000);
    };

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const connectSSE = () => {
      const source = new EventSource('/api/events/stream');
      eventSourceRef.current = source;

      source.onopen = () => {
        setSseConnected(true);
        stopPolling();
      };

      source.onmessage = (event) => {
        if (event.data.startsWith(':')) return;
        refresh();
      };

      source.onerror = () => {
        setSseConnected(false);
        source.close();
        eventSourceRef.current = null;
        startPolling();
      };
    };

    connectSSE();
    startPolling();

    return () => {
      eventSourceRef.current?.close();
      stopPolling();
    };
  }, [workspaceId]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'done' && task.status !== 'review'),
    [tasks]
  );

  const blockedAgents = useMemo(() => {
    const map = new Map<string, string>();

    for (const task of tasks) {
      if (!task.assigned_agent_id) continue;
      // Testing/review = waiting on external action
      if (task.status === 'testing' || task.status === 'review') {
        map.set(task.assigned_agent_id, `Waiting in ${task.status}`);
      }
      // Dispatch errors block progress
      if (task.planning_dispatch_error && task.status !== 'done') {
        map.set(task.assigned_agent_id, `Dispatch error: ${task.planning_dispatch_error.slice(0, 60)}`);
      }
    }

    // Check for recent error events (last 5 minutes)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (const event of events) {
      if (!event.agent_id) continue;
      if (new Date(event.created_at).getTime() < fiveMinAgo) continue;
      const msg = event.message.toLowerCase();
      if (msg.includes('error') || msg.includes('failed') || msg.includes('rate_limit') || msg.includes('blocked')) {
        if (!map.has(event.agent_id)) {
          map.set(event.agent_id, 'Recent error detected');
        }
      }
    }

    for (const agent of agents) {
      if (agent.status === 'offline') {
        const hasAssignedActiveTask = tasks.some(
          (task) => task.assigned_agent_id === agent.id && task.status !== 'done'
        );
        if (hasAssignedActiveTask) map.set(agent.id, 'Offline with assigned work');
      }
    }

    return map;
  }, [agents, tasks, events]);

  const blockedAgentIds = useMemo(() => new Set(blockedAgents.keys()), [blockedAgents]);

  const nowWorking = useMemo(() => {
    return agents
      .filter((agent) => agent.status === 'working')
      .map((agent) => {
        const currentTask = tasks.find(
          (task) => task.assigned_agent_id === agent.id && (task.status === 'in_progress' || task.status === 'assigned' || task.status === 'testing')
        );
        return { agent, currentTask };
      });
  }, [agents, tasks]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (filter === 'all') return true;
      if (filter === 'working') return agent.status === 'working';
      if (filter === 'blocked') return blockedAgentIds.has(agent.id);
      if (filter === 'idle') return agent.status === 'standby' || agent.status === 'offline';
      return true;
    });
  }, [agents, blockedAgentIds, filter]);

  const eventsByAgent = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const event of events) {
      if (!event.agent_id) continue;
      const list = map.get(event.agent_id) ?? [];
      list.push(event);
      map.set(event.agent_id, list);
    }
    return map;
  }, [events]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🦞</div>
          <p className="text-mc-text-secondary">Loading activity dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mc-bg pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="border-b border-mc-border bg-mc-bg-secondary px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={workspace ? `/workspace/${workspace.slug}` : '/'} className="min-h-11 min-w-11 px-3 rounded-lg border border-mc-border bg-mc-bg flex items-center justify-center hover:bg-mc-bg-tertiary">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold truncate">Agent Activity Dashboard</h1>
              <p className="text-xs sm:text-sm text-mc-text-secondary truncate">
                {workspace ? `${workspace.icon} ${workspace.name}` : 'All workspaces'} · {sseConnected ? 'Live (SSE)' : 'Polling fallback'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-2.5 min-h-11 rounded-lg border text-xs flex items-center gap-2 ${sseConnected ? 'text-mc-accent-green border-mc-accent-green/40 bg-mc-accent-green/10' : 'text-mc-accent-yellow border-mc-accent-yellow/40 bg-mc-accent-yellow/10'}`}>
              <RefreshCw className="w-3.5 h-3.5" />
              {sseConnected ? 'LIVE' : 'FALLBACK'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <section className={`grid ${isPortrait ? 'grid-cols-2' : 'grid-cols-4'} gap-3`}>
          <MetricCard label="Agents" value={String(agents.length)} />
          <MetricCard label="Working" value={String(agents.filter((a) => a.status === 'working').length)} />
          <MetricCard label="Blocked" value={String(blockedAgentIds.size)} />
          <MetricCard label="Active Tasks" value={String(activeTasks.length)} />
        </section>

        <section className="bg-mc-bg-secondary border border-mc-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-mc-accent" />
            <h2 className="font-semibold">Now Working</h2>
          </div>
          {nowWorking.length === 0 ? (
            <div className="text-sm text-mc-text-secondary">No agents currently marked as working.</div>
          ) : (
            <div className="space-y-2">
              {nowWorking.map(({ agent, currentTask }) => (
                <div key={agent.id} className="border border-mc-border rounded-lg p-3 bg-mc-bg min-h-11">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{agent.avatar_emoji} {agent.name}</div>
                      <div className="text-xs text-mc-text-secondary truncate">{currentTask?.title || 'No active task linked'}</div>
                    </div>
                    <div className="text-xs text-mc-text-secondary whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(currentTask?.updated_at || agent.updated_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-mc-text-secondary" />
            {(['all', 'working', 'blocked', 'idle'] as ActivityFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`min-h-11 px-4 rounded-full border text-sm capitalize ${filter === tab ? 'bg-mc-accent text-mc-bg border-mc-accent' : 'bg-mc-bg-secondary text-mc-text-secondary border-mc-border'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {filteredAgents.map((agent) => {
              const allAgentEvents = eventsByAgent.get(agent.id) || [];
              const isBlocked = blockedAgentIds.has(agent.id);
              const blockedReason = blockedAgents.get(agent.id);

              return (
                <AgentActivityCard
                  key={agent.id}
                  agent={agent}
                  isBlocked={isBlocked}
                  blockedReason={blockedReason}
                  allEvents={allAgentEvents}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function AgentActivityCard({ agent, isBlocked, blockedReason, allEvents }: {
  agent: Agent;
  isBlocked: boolean;
  blockedReason?: string;
  allEvents: Event[];
}) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 10;
  const displayedEvents = showAll ? allEvents : allEvents.slice(0, DEFAULT_LIMIT);

  return (
    <article className="bg-mc-bg-secondary border border-mc-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{agent.avatar_emoji} {agent.name}</div>
          <div className="text-xs text-mc-text-secondary truncate">{agent.role}</div>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-xs px-2 py-1 rounded uppercase ${agent.status === 'working' ? 'status-working' : agent.status === 'offline' ? 'status-offline' : 'status-standby'}`}>
            {agent.status}
          </span>
          <div className="text-[11px] text-mc-text-secondary mt-1">Updated {formatDistanceToNow(new Date(agent.updated_at), { addSuffix: true })}</div>
        </div>
      </div>

      {isBlocked && (
        <div className="mb-3 p-2.5 rounded-lg border border-mc-accent-red/30 bg-mc-accent-red/10 text-mc-accent-red text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{blockedReason || 'Blocked'}</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase text-mc-text-secondary">Timeline</div>
        {displayedEvents.length === 0 ? (
          <div className="text-xs text-mc-text-secondary">No recent activity for this agent.</div>
        ) : (
          displayedEvents.map((event) => (
            <div key={event.id} className="rounded-lg border border-mc-border bg-mc-bg px-3 py-2.5 min-h-11">
              <div className="text-sm leading-snug">{event.message}</div>
              <div className="text-[11px] text-mc-text-secondary mt-1">{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</div>
            </div>
          ))
        )}
        {!showAll && allEvents.length > DEFAULT_LIMIT && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-mc-accent hover:underline"
          >
            View all {allEvents.length} events
          </button>
        )}
        {showAll && allEvents.length > DEFAULT_LIMIT && (
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-mc-text-secondary hover:underline"
          >
            Show less
          </button>
        )}
      </div>
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-3 sm:p-4 min-h-20">
      <div className="text-[11px] uppercase text-mc-text-secondary">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
