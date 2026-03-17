'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  CalendarDays,
  Server,
  Users,
  BookOpenText,
  Bot,
  Rocket,
  FolderKanban,
  FileSearch,
  Shield,
  Building2,
  Radio,
  CheckSquare,
  LayoutGrid,
  ChevronLeft,
} from 'lucide-react';
import { useMissionControl } from '@/lib/store';

const NAV_ITEMS = [
  { href: '', label: 'Board', icon: LayoutGrid },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/system', label: 'System', icon: Server },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/memory', label: 'Memory', icon: BookOpenText },
  { href: '/pipeline', label: 'Pipeline', icon: Rocket },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/docs', label: 'Docs', icon: FileSearch },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare, badgeKey: 'approvals' as const },
  { href: '/council', label: 'Council', icon: Shield },
  { href: '/radar', label: 'Radar', icon: Radio },
  { href: '/office', label: 'Office', icon: Building2 },
  { href: '/activity', label: 'Activity', icon: Server },
];

export function WorkspaceNav() {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;
  const basePath = `/workspace/${slug}`;
  const { tasks } = useMissionControl();

  const reviewCount = tasks.filter((t) => t.status === 'review').length;

  const getBadge = (badgeKey?: string) => {
    if (badgeKey === 'approvals' && reviewCount > 0) return reviewCount;
    return 0;
  };

  return (
    <nav className="bg-mc-bg-secondary border-b border-mc-border px-2 py-1.5 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        <Link
          href="/"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary transition-colors mr-1"
        >
          <ChevronLeft className="w-3 h-3" />
        </Link>
        {NAV_ITEMS.map(({ href, label, icon: Icon, badgeKey }) => {
          const fullHref = `${basePath}${href}`;
          const isActive = href === ''
            ? pathname === basePath
            : pathname.startsWith(fullHref);
          const badge = getBadge(badgeKey);

          return (
            <Link
              key={href || 'board'}
              href={fullHref}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-mc-accent/15 text-mc-accent border border-mc-accent/25'
                  : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] leading-none rounded-full bg-mc-accent-pink text-white font-medium">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
