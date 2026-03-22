'use client';

import { WorkstreamPage } from '@/components/WorkstreamPage';

export default function RadarPage() {
  return (
    <WorkstreamPage
      title="Radar"
      description="Signals and watchlist queue for emerging risks and opportunities."
      keywordHints={["risk", "opportunity", "monitor", "watch", "radar"]}
      focusStatuses={["inbox", "assigned", "in_progress", "review"]}
    />
  );
}
