/**
 * Aggregated activity feed for the Live Activity View.
 * Returns a unified list of recent events from Mission Control DB
 * plus active session summary from Paperclip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import type { Event } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface FeedEvent {
  id: string;
  kind: 'mc_event' | 'paperclip_run' | 'paperclip_transition';
  type: string;
  agentName?: string;
  agentEmoji?: string;
  taskTitle?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
  const since = searchParams.get('since');

  try {
    let sql = `
      SELECT e.*, a.name as agent_name, a.avatar_emoji as agent_emoji, t.title as task_title
      FROM events e
      LEFT JOIN agents a ON e.agent_id = a.id
      LEFT JOIN tasks t ON e.task_id = t.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (since) {
      sql += ' AND e.created_at > ?';
      params.push(since);
    }

    sql += ' ORDER BY e.created_at DESC LIMIT ?';
    params.push(limit);

    type EventRow = Event & { agent_name?: string; agent_emoji?: string; task_title?: string };
    const rows = queryAll<EventRow>(sql, params);

    const feed: FeedEvent[] = rows.map((row) => ({
      id: `mc_${row.id}`,
      kind: 'mc_event',
      type: row.type,
      agentName: row.agent_name,
      agentEmoji: row.agent_emoji,
      taskTitle: row.task_title,
      message: row.message,
      timestamp: row.created_at,
    }));

    return NextResponse.json({ events: feed, total: feed.length });
  } catch (err) {
    console.error('[activity/feed] DB error:', err);
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}
