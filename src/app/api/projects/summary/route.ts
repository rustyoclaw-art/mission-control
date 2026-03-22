import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

export async function GET() {
  const workspaceRoot = process.env.OPENCLAW_WORKSPACE || join(homedir(), '.openclaw', 'workspace');

  const py = `
import json
from pathlib import Path

root = Path(${JSON.stringify(workspaceRoot)}) / 'automation' / 'state'
projects = []
status_totals = {}

if root.exists():
    try:
        import yaml
    except Exception:
        print(json.dumps({'ok': False, 'error': 'pyyaml not available'}))
        raise SystemExit(0)

    for state_file in sorted(root.glob('*/STATE.yaml')):
        try:
            data = yaml.safe_load(state_file.read_text()) or {}
            tasks = data.get('tasks') or []
            counts = {}
            for t in tasks:
                st = (t or {}).get('status', 'unknown')
                counts[st] = counts.get(st, 0) + 1
                status_totals[st] = status_totals.get(st, 0) + 1

            projects.append({
                'project': state_file.parent.name,
                'taskCount': len(tasks),
                'counts': counts,
                'updatedAt': str(data.get('updated_at') or data.get('updatedAt') or ''),
            })
        except Exception as e:
            projects.append({
                'project': state_file.parent.name,
                'taskCount': 0,
                'counts': {'error': 1},
                'error': str(e),
            })

print(json.dumps({
    'ok': True,
    'totals': {
        'projects': len(projects),
        'tasks': sum(p.get('taskCount', 0) for p in projects),
        'status': status_totals,
    },
    'projects': projects,
}))
`;

  try {
    const { stdout } = await execFileAsync('python3', ['-c', py], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    const parsed = JSON.parse(stdout || '{}');
    if (!parsed.ok) {
      return NextResponse.json(parsed, { status: 500 });
    }
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to read project state',
      },
      { status: 500 }
    );
  }
}
