import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

function todayFileName() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}.md`;
}

function extractBullets(content: string, limit = 8): string[] {
  const lines = content.split('\n');
  const bullets = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || line.startsWith('* '))
    .map((line) => line.replace(/^[-*]\s+/, ''));
  return bullets.slice(0, limit);
}

export async function GET() {
  try {
    const workspace = process.env.OPENCLAW_WORKSPACE || join(homedir(), '.openclaw', 'workspace');
    const memoryDir = join(workspace, 'memory');
    const todayPath = join(memoryDir, todayFileName());

    const [entries, todayContent] = await Promise.all([
      fs.readdir(memoryDir).catch(() => [] as string[]),
      fs.readFile(todayPath, 'utf-8').catch(() => ''),
    ]);

    const dailyFiles = entries
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
      .sort()
      .reverse()
      .slice(0, 7);

    const recentDays = await Promise.all(
      dailyFiles.map(async (name) => {
        const p = join(memoryDir, name);
        const content = await fs.readFile(p, 'utf-8').catch(() => '');
        return {
          date: name.replace('.md', ''),
          bullets: extractBullets(content, 3),
        };
      })
    );

    return NextResponse.json({
      ok: true,
      today: {
        date: todayFileName().replace('.md', ''),
        bullets: extractBullets(todayContent, 12),
      },
      recentDays,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load memory timeline',
      },
      { status: 500 }
    );
  }
}
