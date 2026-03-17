'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Clock, ExternalLink } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Event } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

type FeedFilter = 'all' | 'tasks' | 'agents';

interface LiveFeedProps {
  mobileMode?: boolean;
  isPortrait?: boolean;
}

export function LiveFeed({ mobileMode = false, isPortrait = true }: LiveFeedProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string | undefined;
  const { events, tasks, agents } = useMissionControl();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [isMinimized, setIsMinimized] = useState(false);

  const effectiveMinimized = mobileMode ? false : isMinimized;
  const toggleMinimize = () => setIsMinimized(!isMinimized);

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'tasks') return ['task_created', 'task_assigned', 'task_status_changed', 'task_completed'].includes(event.type);
    if (filter === 'agents') return ['agent_joined', 'agent_status_changed', 'message_sent'].includes(event.type);
    return true;
  });

  return (
    <aside
      className={`bg-mc-bg-secondary ${mobileMode ? 'border border-mc-border rounded-lg h-full' : 'border-l border-mc-border'} flex flex-col transition-all duration-300 ease-in-out ${
        effectiveMinimized ? 'w-12' : mobileMode ? 'w-full' : 'w-80'
      }`}
    >
      <div className="p-3 border-b border-mc-border">
        <div className="flex items-center">
          {!mobileMode && (
            <button
              onClick={toggleMinimize}
              className="p-1 rounded hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors"
              aria-label={effectiveMinimized ? 'Expand feed' : 'Minimize feed'}
            >
              {effectiveMinimized ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          {!effectiveMinimized && <span className="text-sm font-medium uppercase tracking-wider">Live Feed</span>}
        </div>

        {!effectiveMinimized && (
          <div className={`mt-3 ${mobileMode && isPortrait ? 'grid grid-cols-3 gap-2' : 'flex gap-1'}`}>
            {(['all', 'tasks', 'agents'] as FeedFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`min-h-11 text-xs rounded uppercase ${mobileMode && isPortrait ? 'px-1' : 'px-3'} ${
                  filter === tab ? 'bg-mc-accent text-mc-bg font-medium' : 'text-mc-text-secondary hover:bg-mc-bg-tertiary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {!effectiveMinimized && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-mc-text-secondary text-sm">No events yet</div>
          ) : (
            filteredEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                slug={slug}
                onNavigate={(path) => router.push(path)}
                tasks={tasks}
                agents={agents}
              />
            ))
          )}
        </div>
      )}
    </aside>
  );
}

interface EventItemProps {
  event: Event;
  slug?: string;
  onNavigate: (path: string) => void;
  tasks: Array<{ id: string; title: string }>;
  agents: Array<{ id: string; name: string }>;
}

function EventItem({ event, slug, onNavigate, tasks, agents }: EventItemProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'task_created':
        return '📋';
      case 'task_assigned':
        return '👤';
      case 'task_status_changed':
        return '🔄';
      case 'task_completed':
        return '✅';
      case 'message_sent':
        return '💬';
      case 'agent_joined':
        return '🎉';
      case 'agent_status_changed':
        return '🔔';
      case 'system':
        return '⚙️';
      default:
        return '📌';
    }
  };

  const isTaskEvent = ['task_created', 'task_assigned', 'task_completed', 'task_status_changed'].includes(event.type);
  const isAgentEvent = ['agent_joined', 'agent_status_changed'].includes(event.type);
  const isHighlight = event.type === 'task_created' || event.type === 'task_completed';
  const isClickable = (isTaskEvent && event.task_id) || (isAgentEvent && event.agent_id);

  const handleClick = () => {
    if (!slug) return;

    if (isTaskEvent && event.task_id) {
      // Navigate to workspace with task context (main page shows tasks)
      onNavigate(`/workspace/${slug}?task=${event.task_id}`);
    } else if (isAgentEvent && event.agent_id) {
      // Navigate to agent control center
      onNavigate(`/workspace/${slug}/agents?agent=${event.agent_id}`);
    }
  };

  // Find related task/agent for context
  const relatedTask = event.task_id ? tasks.find(t => t.id === event.task_id) : null;
  const relatedAgent = event.agent_id ? agents.find(a => a.id === event.agent_id) : null;

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`p-2 rounded border-l-2 animate-slide-in ${
        isHighlight ? 'bg-mc-bg-tertiary border-mc-accent-pink' : 'bg-transparent border-transparent hover:bg-mc-bg-tertiary'
      } ${isClickable ? 'cursor-pointer group' : ''}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleClick() : undefined}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm">{getEventIcon(event.type)}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${isTaskEvent ? 'text-mc-accent-pink' : 'text-mc-text'} ${isClickable ? 'group-hover:underline' : ''}`}>
            {event.message}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-mc-text-secondary">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </div>
            {isClickable && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-3 h-3" />
                <span>View</span>
              </div>
            )}
          </div>
          {/* Show related entity badge */}
          {(relatedAgent || relatedTask) && (
            <div className="flex items-center gap-2 mt-1.5">
              {relatedAgent && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-mc-bg-tertiary rounded text-mc-text-secondary">
                  {relatedAgent.name}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
