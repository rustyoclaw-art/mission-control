import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

type Action = 'run-now' | 'enable' | 'disable';

async function runOpenClaw(args: string[]) {
  const { stdout, stderr } = await execFileAsync('openclaw', args, {
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
  return { stdout, stderr };
}

export async function POST(request: NextRequest) {
  try {
    const writeEnabled = process.env.MC_CRON_CONTROLS_WRITE_ENABLED === 'true';
    if (!writeEnabled) {
      return NextResponse.json(
        { ok: false, error: 'Cron write controls are disabled (set MC_CRON_CONTROLS_WRITE_ENABLED=true to enable).' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = String(body?.id || '').trim();
    const action = String(body?.action || '').trim() as Action;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });
    }

    if (!['run-now', 'enable', 'disable'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'invalid action' }, { status: 400 });
    }

    try {
      if (action === 'run-now') {
        await runOpenClaw(['cron', 'run', id]);
      } else if (action === 'enable') {
        await runOpenClaw(['cron', 'enable', id]);
      } else {
        await runOpenClaw(['cron', 'disable', id]);
      }
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          id,
          action,
          error: error instanceof Error ? error.message : 'cron control failed',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id, action });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'cron control failed',
      },
      { status: 500 }
    );
  }
}
