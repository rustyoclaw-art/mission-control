import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

type TaskRow = Task & {
  assigned_agent_name?: string | null;
  assigned_agent_emoji?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const dueOnly = searchParams.get('due_date_only') === 'true';

    let sql = `
      SELECT
        t.*,
        aa.name  AS assigned_agent_name,
        aa.avatar_emoji AS assigned_agent_emoji
      FROM tasks t
      LEFT JOIN agents aa ON t.assigned_agent_id = aa.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (dueOnly) {
      sql += ' AND t.due_date IS NOT NULL';
    }
    if (workspaceId) {
      sql += ' AND t.workspace_id = ?';
      params.push(workspaceId);
    }

    sql += ' ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC';

    const rows = queryAll<TaskRow>(sql, params);

    return NextResponse.json({ tasks: rows });
  } catch (error) {
    console.error('[GET /api/calendar/tasks] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar tasks' }, { status: 500 });
  }
}
