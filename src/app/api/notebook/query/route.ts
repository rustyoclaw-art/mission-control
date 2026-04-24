import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseNotebookQaOutput } from '@/lib/notebook-citation-utils';

export const dynamic = 'force-dynamic';

function getWorkspaceDir() {
  return process.env.OPENCLAW_WORKSPACE || join(homedir(), '.openclaw', 'workspace');
}

function runQa(question: string, workspaceDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonBin = join(workspaceDir, 'automation', 'knowledge_base', '.venv', 'bin', 'python3');
    const proc = spawn(pythonBin, ['-m', 'automation.knowledge_base.qa', '--json', question], {
      cwd: workspaceDir,
      env: { ...process.env, PYTHONPATH: workspaceDir },
      timeout: 120_000,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `qa process exited with code ${code}`));
      } else {
        resolve(stdout.trim());
      }
    });
    proc.on('error', reject);
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) {
      return NextResponse.json({ ok: false, error: 'question is required' }, { status: 400 });
    }

    const workspaceDir = getWorkspaceDir();
    const raw = await runQa(question, workspaceDir);
    const parsed = parseNotebookQaOutput(raw);

    return NextResponse.json({ ok: true, ...parsed });
  } catch (error) {
    console.error('[notebook/query]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
