'use client';

import { MemoryTimeline } from '@/components/MemoryTimeline';

export default function MemoryPage() {
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-5">
        <h1 className="text-xl font-semibold">Memory</h1>
        <p className="text-sm text-mc-text-secondary mt-1">Timeline and long-term notes</p>
      </div>
      <MemoryTimeline />
    </div>
  );
}
