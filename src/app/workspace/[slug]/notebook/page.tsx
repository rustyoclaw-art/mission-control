'use client';

import { useState, useRef } from 'react';
import type { Citation } from '@/lib/notebook-citation-utils';

interface QueryResult {
  answer: string;
  citations: Citation[];
  contextCount: number;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-mc-text-secondary/10 text-mc-text-secondary border-mc-border',
};

export default function NotebookPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/notebook/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Query failed');
      setResult({ answer: data.answer, citations: data.citations, contextCount: data.contextCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-5">
        <h1 className="text-xl font-semibold">Notebook</h1>
        <p className="text-sm text-mc-text-secondary mt-1">Ask questions grounded in the knowledge base</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question…"
            disabled={loading}
            className="flex-1 bg-mc-bg border border-mc-border rounded-lg px-3 py-2 text-sm text-mc-text placeholder-mc-text-secondary focus:outline-none focus:border-mc-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 rounded-lg bg-mc-accent text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
            {result.contextCount > 0 && (
              <p className="text-xs text-mc-text-secondary mt-3">
                {result.contextCount} context chunk{result.contextCount !== 1 ? 's' : ''} retrieved
              </p>
            )}
          </div>

          {result.citations.length > 0 && (
            <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4 space-y-3">
              <h2 className="text-xs font-semibold text-mc-text-secondary uppercase tracking-wider">Sources</h2>
              <ul className="space-y-2">
                {result.citations.map((c) => (
                  <li key={c.index} className="flex gap-3 text-sm">
                    <span className="text-mc-text-secondary shrink-0 w-5 text-right">[{c.index}]</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-mc-accent hover:underline truncate"
                        >
                          {c.title}
                        </a>
                        {c.confidence && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${CONFIDENCE_STYLE[c.confidence] ?? CONFIDENCE_STYLE.medium}`}>
                            {c.confidence}
                          </span>
                        )}
                      </div>
                      {c.claim && (
                        <p className="text-xs text-mc-text-secondary mt-0.5 italic">{c.claim}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.citations.length === 0 && (
            <p className="text-xs text-mc-text-secondary px-1">No citations — the model found insufficient context.</p>
          )}
        </div>
      )}
    </div>
  );
}
