'use client';

import { WorkstreamPage } from '@/components/WorkstreamPage';

export default function CouncilPage() {
  return (
    <WorkstreamPage
      title="Council"
      description="Coordination and decision-support queue for leadership-level tasks."
      keywordHints={["decision", "approve", "council", "review", "policy"]}
      focusStatuses={["planning", "assigned", "in_progress", "review"]}
    />
  );
}
