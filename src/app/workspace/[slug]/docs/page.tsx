'use client';

import { DocsBrowser } from '@/components/DocsBrowser';

export default function DocsPage() {
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-5">
        <h1 className="text-xl font-semibold">Docs</h1>
        <p className="text-sm text-mc-text-secondary mt-1">Search and read workspace documents</p>
      </div>
      <DocsBrowser />
    </div>
  );
}
