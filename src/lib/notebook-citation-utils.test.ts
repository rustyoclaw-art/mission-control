import test from 'node:test';
import assert from 'node:assert/strict';

import { parseNotebookQaOutput } from './notebook-citation-utils';

test('parseNotebookQaOutput parses structured JSON with confidence and claim', () => {
  const stdout = JSON.stringify({
    answer: 'TurboQuant reduces memory by 6x [1].',
    citations: [
      { index: 1, title: 'TurboQuant paper', url: 'https://example.com/turboquant', confidence: 'high', claim: 'reduces memory by 6x' },
    ],
    context_count: 3,
  });

  const parsed = parseNotebookQaOutput(stdout);
  assert.equal(parsed.answer, 'TurboQuant reduces memory by 6x [1].');
  assert.equal(parsed.citations.length, 1);
  assert.equal(parsed.citations[0].confidence, 'high');
  assert.equal(parsed.citations[0].claim, 'reduces memory by 6x');
  assert.equal(parsed.contextCount, 3);
});

test('parseNotebookQaOutput returns empty citations when model provides none — no blind fallback', () => {
  const stdout = JSON.stringify({
    answer: 'I do not have enough context to answer.',
    citations: [],
    context_count: 2,
  });

  const parsed = parseNotebookQaOutput(stdout);
  assert.equal(parsed.citations.length, 0);
});

test('parseNotebookQaOutput defaults confidence to medium for legacy responses', () => {
  const stdout = JSON.stringify({
    answer: 'GraphRAG uses retrieval [1].',
    citations: [{ index: 1, title: 'GraphRAG paper', url: 'https://example.com/graphrag' }],
    context_count: 3,
  });

  const parsed = parseNotebookQaOutput(stdout);
  assert.equal(parsed.citations[0].confidence, 'medium');
});

test('parseNotebookQaOutput supports legacy plain-text citation format', () => {
  const stdout = `GraphRAG differs from vanilla RAG by building entity/relationship graphs.\n\nSources:\n[2] GraphRAG overview (https://example.com/graphrag-overview)\n[1] RAG basics (https://example.com/rag-basics)`;

  const parsed = parseNotebookQaOutput(stdout);
  assert.equal(parsed.answer, 'GraphRAG differs from vanilla RAG by building entity/relationship graphs.');
  assert.equal(parsed.citations.length, 2);
  assert.deepEqual(parsed.citations.map((c) => c.index), [1, 2]);
  assert.equal(parsed.citations[0].confidence, 'medium');
});

test('parseNotebookQaOutput has no usedFallbackCitations field', () => {
  const stdout = JSON.stringify({
    answer: 'Test answer.',
    citations: [],
    context_count: 0,
  });

  const parsed = parseNotebookQaOutput(stdout);
  assert.equal('usedFallbackCitations' in parsed, false);
});
