import { NextRequest, NextResponse } from 'next/server';
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

function getMemoryDir() {
  const workspace = process.env.OPENCLAW_WORKSPACE || join(homedir(), '.openclaw', 'workspace');
  return join(workspace, 'memory');
}

// GET: List all memory entries from today's file
export async function GET() {
  try {
    const memoryDir = getMemoryDir();
    const todayPath = join(memoryDir, todayFileName());

    const content = await fs.readFile(todayPath, 'utf-8').catch(() => '');
    const lines = content.split('\n')
      .map((line, index) => ({ line: line.trim(), index }))
      .filter(({ line }) => line.startsWith('- ') || line.startsWith('* '))
      .map(({ line, index }) => ({
        id: `${todayFileName()}-${index}`,
        content: line.replace(/^[-*]\s+/, ''),
        date: todayFileName().replace('.md', ''),
        lineIndex: index,
      }));

    return NextResponse.json({
      ok: true,
      entries: lines,
      date: todayFileName().replace('.md', ''),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load memory' },
      { status: 500 }
    );
  }
}

// POST: Add a new memory entry to today's file
export async function POST(request: NextRequest) {
  try {
    const { content, type } = await request.json();

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    const memoryDir = getMemoryDir();
    const todayPath = join(memoryDir, todayFileName());

    // Ensure directory exists
    await fs.mkdir(memoryDir, { recursive: true });

    // Read existing content
    let existing = await fs.readFile(todayPath, 'utf-8').catch(() => '');

    // Add type prefix if provided
    const typePrefix = type ? `[${type}] ` : '';
    const newEntry = `- ${typePrefix}${content.trim()}`;

    // Append the new entry
    if (existing && !existing.endsWith('\n')) {
      existing += '\n';
    }
    const newContent = existing + newEntry + '\n';

    await fs.writeFile(todayPath, newContent, 'utf-8');

    return NextResponse.json({
      ok: true,
      message: 'Memory entry added',
      entry: {
        content: content.trim(),
        type: type || null,
        date: todayFileName().replace('.md', ''),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to add memory' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a memory entry by line content match
export async function DELETE(request: NextRequest) {
  try {
    const { content, date } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    const memoryDir = getMemoryDir();
    const fileName = date ? `${date}.md` : todayFileName();
    const filePath = join(memoryDir, fileName);

    const existing = await fs.readFile(filePath, 'utf-8').catch(() => '');
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Memory file not found' },
        { status: 404 }
      );
    }

    const lines = existing.split('\n');
    const contentToMatch = content.trim();

    // Find and remove the line that matches the content
    const newLines = lines.filter(line => {
      const trimmed = line.trim();
      const lineContent = trimmed.replace(/^[-*]\s+/, '').replace(/^\[[^\]]+\]\s*/, '');
      return lineContent !== contentToMatch;
    });

    if (lines.length === newLines.length) {
      return NextResponse.json(
        { ok: false, error: 'Entry not found' },
        { status: 404 }
      );
    }

    await fs.writeFile(filePath, newLines.join('\n'), 'utf-8');

    return NextResponse.json({
      ok: true,
      message: 'Memory entry deleted',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
