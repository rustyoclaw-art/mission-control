import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface CronJobState {
  lastStatus?: string;
  lastRunStatus?: string;
  lastRunAtMs?: number;
  nextRunAtMs?: number;
  lastError?: string;
}

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  state?: CronJobState;
}

export async function GET() {
  try {
    const { stdout } = await execFileAsync('openclaw', ['cron', 'list', '--all', '--json'], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    const parsed = JSON.parse(stdout || '{}') as { jobs?: CronJob[] };
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];

    const enabledJobs = jobs.filter((j) => j.enabled);
    const errorJobs = enabledJobs.filter((j) => {
      const status = j.state?.lastStatus || j.state?.lastRunStatus;
      return status === 'error' || status === 'failure';
    });

    const nextRuns = enabledJobs
      .map((j) => ({ name: j.name, nextRunAtMs: j.state?.nextRunAtMs }))
      .filter((j) => typeof j.nextRunAtMs === 'number')
      .sort((a, b) => (a.nextRunAtMs as number) - (b.nextRunAtMs as number))
      .slice(0, 5);

    const recentFailures = errorJobs
      .map((j) => ({
        id: j.id,
        name: j.name,
        lastRunAtMs: j.state?.lastRunAtMs,
        lastError: j.state?.lastError,
      }))
      .sort((a, b) => (b.lastRunAtMs || 0) - (a.lastRunAtMs || 0))
      .slice(0, 5);

    return NextResponse.json({
      ok: true,
      totals: {
        all: jobs.length,
        enabled: enabledJobs.length,
        failing: errorJobs.length,
      },
      failingJobs: errorJobs.map((j) => ({ id: j.id, name: j.name })),
      recentFailures,
      nextRuns,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to read cron status',
      },
      { status: 500 }
    );
  }
}
