/**
 * Proxy to Paperclip API for live activity data.
 * Fetches active agent runs and recent issue transitions.
 * Cached for 30s to avoid hammering the Paperclip API.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL || 'http://100.71.208.5:3100';
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;

let cache: { data: PaperclipActivityData; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export interface PaperclipRun {
  id: string;
  agentId: string;
  agentName?: string;
  issueId?: string;
  issueIdentifier?: string;
  issueTitle?: string;
  status: string;
  startedAt: string;
  updatedAt: string;
}

export interface PaperclipIssueTransition {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
  assigneeName?: string;
}

export interface PaperclipActivityData {
  activeRuns: PaperclipRun[];
  recentTransitions: PaperclipIssueTransition[];
  fetchedAt: string;
  error?: string;
}

async function fetchPaperclipActivity(): Promise<PaperclipActivityData> {
  if (!PAPERCLIP_API_KEY || !PAPERCLIP_COMPANY_ID) {
    return {
      activeRuns: [],
      recentTransitions: [],
      fetchedAt: new Date().toISOString(),
      error: 'Paperclip credentials not configured',
    };
  }

  const headers = {
    Authorization: `Bearer ${PAPERCLIP_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const [runsRes, issuesRes] = await Promise.allSettled([
      fetch(`${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/runs?status=running&limit=20`, {
        headers,
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/issues?status=in_progress,in_review,done&limit=30`, {
        headers,
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    const activeRuns: PaperclipRun[] = [];
    if (runsRes.status === 'fulfilled' && runsRes.value.ok) {
      const data = await runsRes.value.json();
      const runs = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
      for (const run of runs) {
        activeRuns.push({
          id: run.id,
          agentId: run.agentId ?? run.agent_id,
          agentName: run.agent?.name ?? run.agentName,
          issueId: run.issueId ?? run.issue_id,
          issueIdentifier: run.issue?.identifier,
          issueTitle: run.issue?.title,
          status: run.status,
          startedAt: run.startedAt ?? run.created_at,
          updatedAt: run.updatedAt ?? run.updated_at,
        });
      }
    }

    const recentTransitions: PaperclipIssueTransition[] = [];
    if (issuesRes.status === 'fulfilled' && issuesRes.value.ok) {
      const data = await issuesRes.value.json();
      const issues = Array.isArray(data) ? data : data.issues ?? data.data ?? [];
      // Sort by updatedAt desc, take most recent 20
      const sorted = [...issues].sort((a, b) =>
        new Date(b.updatedAt ?? b.updated_at).getTime() - new Date(a.updatedAt ?? a.updated_at).getTime()
      );
      for (const issue of sorted.slice(0, 20)) {
        recentTransitions.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          updatedAt: issue.updatedAt ?? issue.updated_at,
          assigneeName: issue.assignee?.name ?? issue.assigneeAgent?.name,
        });
      }
    }

    return { activeRuns, recentTransitions, fetchedAt: new Date().toISOString() };
  } catch (err) {
    return {
      activeRuns: [],
      recentTransitions: [],
      fetchedAt: new Date().toISOString(),
      error: String(err),
    };
  }
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(Math.floor((now - cache.fetchedAt) / 1000)) },
    });
  }

  const data = await fetchPaperclipActivity();
  cache = { data, fetchedAt: now };
  return NextResponse.json(data, { headers: { 'X-Cache': 'MISS' } });
}
