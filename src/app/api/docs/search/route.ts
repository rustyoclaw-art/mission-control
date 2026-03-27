import { NextRequest, NextResponse } from 'next/server';
import { Dirent, promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

type DocItem = {
  path: string;
  name: string;
  section: string;
  mtimeMs: number;
  preview: string;
};

const MAX_FILES = 400;
const MAX_PREVIEW = 180;

async function walkMarkdown(root: string, section: string, limit: { count: number }): Promise<DocItem[]> {
  const out: DocItem[] = [];

  async function walk(dir: string) {
    if (limit.count >= MAX_FILES) return;
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (limit.count >= MAX_FILES) break;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        await walk(full);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      try {
        const [stat, content] = await Promise.all([
          fs.stat(full),
          fs.readFile(full, 'utf-8').catch(() => ''),
        ]);
        limit.count += 1;
        out.push({
          path: full,
          name: entry.name,
          section,
          mtimeMs: stat.mtimeMs,
          preview: content.replace(/\s+/g, ' ').trim().slice(0, MAX_PREVIEW),
        });
      } catch {
        // ignore unreadable files
      }
    }
  }

  await walk(root);
  return out;
}

function scoreItem(item: DocItem, q: string): number {
  const hay = `${item.name} ${item.path} ${item.preview}`.toLowerCase();
  const query = q.toLowerCase();
  if (!query) return 1;
  if (item.name.toLowerCase().includes(query)) return 5;
  if (item.path.toLowerCase().includes(query)) return 3;
  if (hay.includes(query)) return 2;
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    const workspace = process.env.OPENCLAW_WORKSPACE || join(homedir(), '.openclaw', 'workspace');
    const reportsDir = join(workspace, 'reports');
    const docsDir = join(workspace, 'external', 'mission-control', 'docs');

    const limit = { count: 0 };
    const reports = await walkMarkdown(reportsDir, 'reports', limit);
    const docs = await walkMarkdown(docsDir, 'docs', limit);

    const all = [...reports, ...docs]
      .map((item) => ({ item, score: scoreItem(item, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.item.mtimeMs - a.item.mtimeMs;
      })
      .slice(0, 80)
      .map(({ item }) => ({
        ...item,
        path: item.path.replace(`${workspace}/`, ''),
      }));

    return NextResponse.json({
      ok: true,
      query: q,
      count: all.length,
      items: all,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to search docs',
      },
      { status: 500 }
    );
  }
}
