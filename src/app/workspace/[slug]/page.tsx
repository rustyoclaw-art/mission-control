'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ListTodo, Users, Activity, Settings as SettingsIcon, ExternalLink, Home, BarChart3 } from 'lucide-react';
import { Header } from '@/components/Header';
import { AgentsSidebar } from '@/components/AgentsSidebar';
import { MissionQueue } from '@/components/MissionQueue';
import { LiveFeed } from '@/components/LiveFeed';
import { SSEDebugPanel } from '@/components/SSEDebugPanel';
import { AsyncErrorBoundary } from '@/components/ErrorBoundary';
import { useMissionControl } from '@/lib/store';
import { useSSE } from '@/hooks/useSSE';
import { debug } from '@/lib/debug';
import type { Task, Workspace } from '@/lib/types';

type MobileTab = 'queue' | 'agents' | 'feed' | 'settings';

export default function WorkspacePage() {
  const params = useParams();
  const slug = params.slug as string;

  const { setAgents, setTasks, setEvents, setIsOnline, setIsLoading, isLoading } = useMissionControl();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('queue');
  const [isPortrait, setIsPortrait] = useState(true);

  // Error states for partial API failures
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [lastAgentsSuccess, setLastAgentsSuccess] = useState<Date | null>(null);
  const [lastTasksSuccess, setLastTasksSuccess] = useState<Date | null>(null);
  const [lastEventsSuccess, setLastEventsSuccess] = useState<Date | null>(null);

  useSSE();

  // Retry callbacks for error boundaries
  const retryAgents = useCallback(async () => {
    if (!workspace) return;
    try {
      const res = await fetch(`/api/agents?workspace_id=${workspace.id}`);
      if (res.ok) {
        setAgents(await res.json());
        setAgentsError(null);
        setLastAgentsSuccess(new Date());
      }
    } catch (error) {
      console.error('Retry agents failed:', error);
    }
  }, [workspace, setAgents]);

  const retryTasks = useCallback(async () => {
    if (!workspace) return;
    try {
      const res = await fetch(`/api/tasks?workspace_id=${workspace.id}`);
      if (res.ok) {
        setTasks(await res.json());
        setTasksError(null);
        setLastTasksSuccess(new Date());
      }
    } catch (error) {
      console.error('Retry tasks failed:', error);
    }
  }, [workspace, setTasks]);

  const retryEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        setEvents(await res.json());
        setEventsError(null);
        setLastEventsSuccess(new Date());
      }
    } catch (error) {
      console.error('Retry events failed:', error);
    }
  }, [setEvents]);

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    const updateOrientation = () => setIsPortrait(media.matches);

    updateOrientation();
    media.addEventListener('change', updateOrientation);
    window.addEventListener('resize', updateOrientation);

    return () => {
      media.removeEventListener('change', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const res = await fetch(`/api/workspaces/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setWorkspace(data);
        } else if (res.status === 404) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Failed to load workspace:', error);
        setNotFound(true);
        setIsLoading(false);
        return;
      }
    }

    loadWorkspace();
  }, [slug, setIsLoading]);

  useEffect(() => {
    if (!isPortrait && mobileTab === 'queue') {
      setMobileTab('agents');
    }
  }, [isPortrait, mobileTab]);

  useEffect(() => {
    if (!workspace) return;

    const workspaceId = workspace.id;

    async function loadData() {
      debug.api('Loading workspace data...', { workspaceId });

      // Load agents
      try {
        const agentsRes = await fetch(`/api/agents?workspace_id=${workspaceId}`);
        if (agentsRes.ok) {
          setAgents(await agentsRes.json());
          setAgentsError(null);
          setLastAgentsSuccess(new Date());
        } else {
          setAgentsError(`Failed to load agents (${agentsRes.status})`);
          console.error('Agents API error:', agentsRes.status);
        }
      } catch (error) {
        setAgentsError('Unable to load agents');
        console.error('Failed to load agents:', error);
      }

      // Load tasks
      try {
        const tasksRes = await fetch(`/api/tasks?workspace_id=${workspaceId}`);
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          debug.api('Loaded tasks', { count: tasksData.length });
          setTasks(tasksData);
          setTasksError(null);
          setLastTasksSuccess(new Date());
        } else {
          setTasksError(`Failed to load tasks (${tasksRes.status})`);
          console.error('Tasks API error:', tasksRes.status);
        }
      } catch (error) {
        setTasksError('Unable to load tasks');
        console.error('Failed to load tasks:', error);
      }

      // Load events
      try {
        const eventsRes = await fetch('/api/events');
        if (eventsRes.ok) {
          setEvents(await eventsRes.json());
          setEventsError(null);
          setLastEventsSuccess(new Date());
        } else {
          setEventsError(`Failed to load events (${eventsRes.status})`);
          console.error('Events API error:', eventsRes.status);
        }
      } catch (error) {
        setEventsError('Unable to load events');
        console.error('Failed to load events:', error);
      }

      setIsLoading(false);
    }

    async function checkOpenClaw() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const openclawRes = await fetch('/api/openclaw/status', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (openclawRes.ok) {
          const status = await openclawRes.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }

    loadData();
    checkOpenClaw();

    const eventPoll = setInterval(async () => {
      try {
        const res = await fetch('/api/events?limit=20');
        if (res.ok) {
          setEvents(await res.json());
        }
      } catch (error) {
        console.error('Failed to poll events:', error);
      }
    }, 30000);

    const taskPoll = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks?workspace_id=${workspaceId}`);
        if (res.ok) {
          const newTasks: Task[] = await res.json();
          const currentTasks = useMissionControl.getState().tasks;

          const hasChanges =
            newTasks.length !== currentTasks.length ||
            newTasks.some((t) => {
              const current = currentTasks.find((ct) => ct.id === t.id);
              return !current || current.updated_at !== t.updated_at;
            });

          if (hasChanges) {
            debug.api('[FALLBACK] Task changes detected via polling, updating store');
            setTasks(newTasks);
          }
        }
      } catch (error) {
        console.error('Failed to poll tasks:', error);
      }
    }, 60000);

    const connectionCheck = setInterval(async () => {
      try {
        const res = await fetch('/api/openclaw/status');
        if (res.ok) {
          const status = await res.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }, 30000);

    return () => {
      clearInterval(eventPoll);
      clearInterval(connectionCheck);
      clearInterval(taskPoll);
    };
  }, [workspace, setAgents, setTasks, setEvents, setIsOnline, setIsLoading]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Workspace Not Found</h1>
          <p className="text-mc-text-secondary mb-6">The workspace &ldquo;{slug}&rdquo; doesn&apos;t exist.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦞</div>
          <p className="text-mc-text-secondary">Loading {slug}...</p>
        </div>
      </div>
    );
  }

  const showMobileBottomTabs = isPortrait;

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <Header workspace={workspace} isPortrait={isPortrait} />

      <div className="hidden lg:flex flex-1 overflow-hidden">
        <AsyncErrorBoundary
          error={agentsError}
          title="Unable to load agents"
          onRetry={retryAgents}
          lastSuccessTime={lastAgentsSuccess}
        >
          <AgentsSidebar workspaceId={workspace.id} />
        </AsyncErrorBoundary>
        <AsyncErrorBoundary
          error={tasksError}
          title="Unable to load tasks"
          onRetry={retryTasks}
          lastSuccessTime={lastTasksSuccess}
        >
          <MissionQueue workspaceId={workspace.id} />
        </AsyncErrorBoundary>
        <AsyncErrorBoundary
          error={eventsError}
          title="Unable to load events"
          onRetry={retryEvents}
          lastSuccessTime={lastEventsSuccess}
        >
          <LiveFeed />
        </AsyncErrorBoundary>
      </div>

      <div
        className={`lg:hidden flex-1 overflow-hidden ${
          showMobileBottomTabs ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]' : 'pb-[env(safe-area-inset-bottom)]'
        }`}
      >
        {isPortrait ? (
          <>
            {mobileTab === 'queue' && (
              <AsyncErrorBoundary error={tasksError} title="Unable to load tasks" onRetry={retryTasks} lastSuccessTime={lastTasksSuccess}>
                <MissionQueue workspaceId={workspace.id} mobileMode isPortrait />
              </AsyncErrorBoundary>
            )}
            {mobileTab === 'agents' && (
              <div className="h-full p-3 overflow-y-auto">
                <AsyncErrorBoundary error={agentsError} title="Unable to load agents" onRetry={retryAgents} lastSuccessTime={lastAgentsSuccess}>
                  <AgentsSidebar workspaceId={workspace.id} mobileMode isPortrait />
                </AsyncErrorBoundary>
              </div>
            )}
            {mobileTab === 'feed' && (
              <div className="h-full p-3 overflow-y-auto">
                <AsyncErrorBoundary error={eventsError} title="Unable to load events" onRetry={retryEvents} lastSuccessTime={lastEventsSuccess}>
                  <LiveFeed mobileMode isPortrait />
                </AsyncErrorBoundary>
              </div>
            )}
            {mobileTab === 'settings' && <MobileSettingsPanel workspace={workspace} />}
          </>
        ) : (
          <div className="h-full p-3 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
            <AsyncErrorBoundary error={tasksError} title="Unable to load tasks" onRetry={retryTasks} lastSuccessTime={lastTasksSuccess}>
              <MissionQueue workspaceId={workspace.id} mobileMode isPortrait={false} />
            </AsyncErrorBoundary>
            <div className="min-w-0 h-full flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setMobileTab('agents')}
                  className={`min-h-11 rounded-lg text-xs ${mobileTab === 'agents' ? 'bg-mc-accent text-mc-bg font-medium' : 'bg-mc-bg-secondary border border-mc-border text-mc-text-secondary'}`}
                >
                  Agents
                </button>
                <button
                  onClick={() => setMobileTab('feed')}
                  className={`min-h-11 rounded-lg text-xs ${mobileTab === 'feed' ? 'bg-mc-accent text-mc-bg font-medium' : 'bg-mc-bg-secondary border border-mc-border text-mc-text-secondary'}`}
                >
                  Feed
                </button>
                <button
                  onClick={() => setMobileTab('settings')}
                  className={`min-h-11 rounded-lg text-xs ${mobileTab === 'settings' ? 'bg-mc-accent text-mc-bg font-medium' : 'bg-mc-bg-secondary border border-mc-border text-mc-text-secondary'}`}
                >
                  Settings
                </button>
              </div>

              <div className="min-h-0 flex-1">
                {mobileTab === 'settings' ? (
                  <MobileSettingsPanel workspace={workspace} denseLandscape />
                ) : mobileTab === 'agents' ? (
                  <AsyncErrorBoundary error={agentsError} title="Unable to load agents" onRetry={retryAgents} lastSuccessTime={lastAgentsSuccess}>
                    <AgentsSidebar workspaceId={workspace.id} mobileMode isPortrait={false} />
                  </AsyncErrorBoundary>
                ) : (
                  <AsyncErrorBoundary error={eventsError} title="Unable to load events" onRetry={retryEvents} lastSuccessTime={lastEventsSuccess}>
                    <LiveFeed mobileMode isPortrait={false} />
                  </AsyncErrorBoundary>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showMobileBottomTabs && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-mc-border bg-mc-bg-secondary pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4 gap-1 p-2">
            <MobileTabButton label="Queue" active={mobileTab === 'queue'} icon={<ListTodo className="w-5 h-5" />} onClick={() => setMobileTab('queue')} />
            <MobileTabButton label="Agents" active={mobileTab === 'agents'} icon={<Users className="w-5 h-5" />} onClick={() => setMobileTab('agents')} />
            <MobileTabButton label="Feed" active={mobileTab === 'feed'} icon={<Activity className="w-5 h-5" />} onClick={() => setMobileTab('feed')} />
            <MobileTabButton label="Settings" active={mobileTab === 'settings'} icon={<SettingsIcon className="w-5 h-5" />} onClick={() => setMobileTab('settings')} />
          </div>
        </nav>
      )}

      <SSEDebugPanel />
    </div>
  );
}

function MobileTabButton({ label, active, icon, onClick }: { label: string; active: boolean; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 rounded-lg flex flex-col items-center justify-center text-xs ${
        active ? 'bg-mc-accent text-mc-bg font-medium' : 'text-mc-text-secondary'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileSettingsPanel({ workspace, denseLandscape = false }: { workspace: Workspace; denseLandscape?: boolean }) {
  return (
    <div className={`h-full overflow-y-auto ${denseLandscape ? 'p-0 pb-[env(safe-area-inset-bottom)]' : 'p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]'}`}>
      <div className="space-y-3">
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4">
          <div className="text-sm text-mc-text-secondary mb-2">Current workspace</div>
          <div className="flex items-center gap-2 text-base font-medium">
            <span>{workspace.icon}</span>
            <span>{workspace.name}</span>
          </div>
          <div className="text-xs text-mc-text-secondary mt-1">/{workspace.slug}</div>
        </div>


        <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1 mt-1">Pages</div>
        {[
          { href: `/workspace/${workspace.slug}/calendar`, label: 'Calendar & Cron' },
          { href: `/workspace/${workspace.slug}/system`, label: 'System Health' },
          { href: `/workspace/${workspace.slug}/team`, label: 'Team Operations' },
          { href: `/workspace/${workspace.slug}/agents`, label: 'Agent Control Center' },
          { href: `/workspace/${workspace.slug}/memory`, label: 'Memory Timeline' },
          { href: `/workspace/${workspace.slug}/pipeline`, label: 'Pipeline Operations' },
          { href: `/workspace/${workspace.slug}/projects`, label: 'Projects' },
          { href: `/workspace/${workspace.slug}/docs`, label: 'Docs & Artifacts' },
          { href: `/workspace/${workspace.slug}/approvals`, label: 'Approvals' },
          { href: `/workspace/${workspace.slug}/council`, label: 'Council' },
          { href: `/workspace/${workspace.slug}/radar`, label: 'Radar' },
          { href: `/workspace/${workspace.slug}/office`, label: 'Office' },
          { href: `/workspace/${workspace.slug}/activity`, label: 'Agent Activity Dashboard' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="w-full min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-secondary flex items-center justify-between text-sm">
            <span>{label}</span>
            <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
          </Link>
        ))}

        <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1 mt-2">Settings</div>
        <Link href="/settings" className="w-full min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-secondary flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Open Mission Control Settings
          </span>
          <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
        </Link>

        <Link href="/" className="w-full min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-secondary flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Back to Workspaces
          </span>
          <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
        </Link>
      </div>
    </div>
  );
}
