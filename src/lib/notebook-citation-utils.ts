/** A single parsed citation from notebook QA output. */
export interface Citation {
  index: number;
  title: string;
  url: string;
  confidence?: 'high' | 'medium' | 'low';
  claim?: string;
}

export interface ParsedNotebookQaOutput {
  answer: string;
  citations: Citation[];
  contextCount: number;
}

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return undefined;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  let s = text.trim();
  if (s.startsWith('```')) {
    const nl = s.indexOf('\n');
    if (nl !== -1) s = s.slice(nl + 1);
    if (s.endsWith('```')) s = s.slice(0, -3).trimEnd();
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last <= first) return null;
  s = s.slice(first, last + 1);
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function stripCitationSections(text: string): string {
  return text
    .replace(/\n{1,3}(?:Sources|References|Citations)\s*:\s*\n[\s\S]*$/i, '')
    .replace(/\n{1,3}(?:\[?\d+\]?[.)]\s+.+\(https?:\/\/[^\s)]+\)\s*\n?){2,}$/, '')
    .trim();
}

function parseLegacyCitations(text: string): { answer: string; citations: Citation[] } {
  const answer = stripCitationSections(text);
  const citedIndices = new Set<number>();

  const canonicalRe = /\[(\d+)\]\s+.+?\s+\(https?:\/\/[^\s)]+\)/g;
  let m: RegExpExecArray | null;
  while ((m = canonicalRe.exec(text)) !== null) citedIndices.add(parseInt(m[1], 10));
  const inlineRe = /\[(\d+)\]/g;
  while ((m = inlineRe.exec(text)) !== null) citedIndices.add(parseInt(m[1], 10));

  const urlMap = new Map<number, { title: string; url: string }>();
  const srcRe = /\[(\d+)\]\s+(.+?)\s+\((https?:\/\/[^\s)]+)\)/g;
  while ((m = srcRe.exec(text)) !== null) {
    urlMap.set(parseInt(m[1], 10), { title: m[2].trim(), url: m[3].trim() });
  }

  const citations: Citation[] = [];
  for (const idx of Array.from(citedIndices).sort((a, b) => a - b)) {
    const meta = urlMap.get(idx);
    if (!meta?.url) continue;
    citations.push({ index: idx, title: meta.title || 'Untitled source', url: meta.url });
  }
  return { answer, citations };
}

export function normalizeCitations(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return [];
  const out: Citation[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const idx = typeof (c as { index?: unknown }).index === 'number'
      ? (c as { index: number }).index
      : parseInt(String((c as { index?: unknown }).index), 10);
    if (!Number.isFinite(idx) || idx < 1) continue;
    const title = typeof (c as { title?: unknown }).title === 'string'
      ? (c as { title: string }).title.trim()
      : '';
    const url = typeof (c as { url?: unknown }).url === 'string'
      ? (c as { url: string }).url.trim()
      : '';
    if (!url) continue;

    const confidence = typeof (c as { confidence?: unknown }).confidence === 'string'
      ? (c as { confidence: string }).confidence as Citation['confidence']
      : undefined;
    const claim = typeof (c as { claim?: unknown }).claim === 'string'
      ? ((c as { claim: string }).claim).trim()
      : undefined;

    out.push({
      index: idx,
      title: title || 'Untitled source',
      url,
      ...(confidence && { confidence }),
      ...(claim !== undefined && claim !== '' && { claim }),
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

export function parseNotebookQaOutput(stdout: string): ParsedNotebookQaOutput {
  const fallback = parseLegacyCitations(stdout.trim());
  const parsed = parseJsonObject(stdout);

  if (!parsed) {
    for (const c of fallback.citations) {
      if (!c.confidence) c.confidence = 'medium';
    }
    return {
      answer: fallback.answer,
      citations: fallback.citations,
      contextCount: 0,
    };
  }

  const rawAnswer = typeof parsed.answer === 'string' ? parsed.answer : fallback.answer;
  const answer = stripCitationSections(rawAnswer);
  const citations = normalizeCitations(parsed.citations);
  const contextCount = toPositiveInt(parsed.context_count) ?? 0;

  for (const c of citations) {
    if (!c.confidence) c.confidence = 'medium';
  }

  return {
    answer: answer || fallback.answer,
    citations,
    contextCount,
  };
}
