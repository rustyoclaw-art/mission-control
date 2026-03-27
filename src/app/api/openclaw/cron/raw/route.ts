import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const { stdout } = await execFileAsync('openclaw', ['cron', 'list', '--all', '--json'], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    const parsed = JSON.parse(stdout || '{}');
    const writeEnabled = process.env.MC_CRON_CONTROLS_WRITE_ENABLED === 'true';
    return NextResponse.json({ ...parsed, writeEnabled });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to list cron jobs' },
      { status: 500 }
    );
  }
}
