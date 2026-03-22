'use client';

import { usePathname, useParams } from 'next/navigation';
import { WorkspaceNav } from '@/components/WorkspaceNav';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;

  // Don't show nav on the main dashboard page — it has its own full layout
  const isMainDashboard = pathname === `/workspace/${slug}`;

  if (isMainDashboard) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <WorkspaceNav />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
