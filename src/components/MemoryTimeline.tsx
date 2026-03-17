'use client';

import { useEffect, useState, useMemo } from 'react';
import { BookOpenText, Plus, Trash2, Search, X, AlertTriangle } from 'lucide-react';

type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

type MemoryResponse = {
  ok: boolean;
  today?: {
    date: string;
    bullets: string[];
  };
  recentDays?: Array<{
    date: string;
    bullets: string[];
  }>;
};

const TYPE_COLORS: Record<MemoryType, string> = {
  user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  feedback: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  project: 'bg-green-500/20 text-green-400 border-green-500/30',
  reference: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

function extractType(bullet: string): { type: MemoryType | null; content: string } {
  const match = bullet.match(/^\[(\w+)\]\s*/);
  if (match && ['user', 'feedback', 'project', 'reference'].includes(match[1].toLowerCase())) {
    return {
      type: match[1].toLowerCase() as MemoryType,
      content: bullet.slice(match[0].length),
    };
  }
  return { type: null, content: bullet };
}

export function MemoryTimeline() {
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ content: string; date: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch('/api/memory/today');
      const body = await res.json();
      setData(body);
    } catch {
      setData({ ok: false });
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 60000);
    return () => clearInterval(timer);
  }, []);

  // Filter bullets based on search query
  const filteredData = useMemo(() => {
    if (!data || !data.ok) return data;
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();

    const filterBullets = (bullets: string[]) =>
      bullets.filter(b => b.toLowerCase().includes(query));

    return {
      ...data,
      today: data.today ? {
        ...data.today,
        bullets: filterBullets(data.today.bullets),
      } : undefined,
      recentDays: data.recentDays?.map(day => ({
        ...day,
        bullets: filterBullets(day.bullets),
      })).filter(day => day.bullets.length > 0),
    };
  }, [data, searchQuery]);

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: showDeleteConfirm.content,
          date: showDeleteConfirm.date,
        }),
      });
      if (res.ok) {
        await loadData();
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div className="px-3 pb-3">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mc-text-secondary">
            <BookOpenText className="w-4 h-4" />
            <span>Memory Timeline</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-mc-accent text-mc-bg font-medium hover:bg-mc-accent/90"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Memory
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-mc-bg border border-mc-border rounded-lg focus:outline-none focus:border-mc-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!filteredData ? (
          <p className="mt-2 text-sm text-mc-text-secondary">Loading timeline...</p>
        ) : !filteredData.ok ? (
          <p className="mt-2 text-sm text-mc-accent-red">Could not load memory timeline.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className="bg-mc-bg border border-mc-border rounded p-3">
              <h3 className="text-sm font-semibold">Today ({filteredData.today?.date})</h3>
              <ul className="mt-2 space-y-1.5">
                {(filteredData.today?.bullets || []).length === 0 ? (
                  <li className="text-sm text-mc-text-secondary">
                    {searchQuery ? 'No matching entries.' : 'No timeline bullets yet for today.'}
                  </li>
                ) : (
                  filteredData.today?.bullets?.slice(0, 12).map((item, i) => {
                    const { type, content } = extractType(item);
                    return (
                      <li key={`today-${i}`} className="group flex items-start gap-2 text-sm text-mc-text-secondary">
                        <span className="flex-shrink-0 mt-0.5">•</span>
                        {type && (
                          <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] uppercase rounded border ${TYPE_COLORS[type]}`}>
                            {type}
                          </span>
                        )}
                        <span className="flex-1">{content}</span>
                        <button
                          onClick={() => setShowDeleteConfirm({ content, date: filteredData.today!.date })}
                          className="opacity-0 group-hover:opacity-100 p-1 text-mc-text-secondary hover:text-mc-accent-red transition-opacity"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>

            <section className="bg-mc-bg border border-mc-border rounded p-3">
              <h3 className="text-sm font-semibold">Recent Days</h3>
              <div className="mt-2 space-y-2 text-sm text-mc-text-secondary">
                {(filteredData.recentDays || []).length === 0 ? (
                  <p>{searchQuery ? 'No matching entries in recent days.' : 'No recent entries.'}</p>
                ) : (
                  filteredData.recentDays?.slice(0, 4).map((day) => (
                    <div key={day.date}>
                      <div className="font-medium text-mc-text">{day.date}</div>
                      <ul className="ml-3 mt-1 space-y-1">
                        {(day.bullets || []).slice(0, 3).map((b, i) => {
                          const { type, content } = extractType(b);
                          return (
                            <li key={`${day.date}-${i}`} className="group flex items-start gap-2">
                              <span className="flex-shrink-0 mt-0.5">•</span>
                              {type && (
                                <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] uppercase rounded border ${TYPE_COLORS[type]}`}>
                                  {type}
                                </span>
                              )}
                              <span className="flex-1">{content}</span>
                              <button
                                onClick={() => setShowDeleteConfirm({ content, date: day.date })}
                                className="opacity-0 group-hover:opacity-100 p-1 text-mc-text-secondary hover:text-mc-accent-red transition-opacity"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <AddMemoryModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            loadData();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-mc-bg-secondary border border-mc-border rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-mc-accent-red/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-mc-accent-red" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Delete Memory Entry</h3>
                <p className="text-sm text-mc-text-secondary">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-mc-text-secondary mb-4 text-sm">
              Are you sure you want to delete this entry?
            </p>
            <p className="bg-mc-bg border border-mc-border rounded p-3 text-sm mb-6 line-clamp-3">
              {showDeleteConfirm.content}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-mc-text-secondary hover:text-mc-text"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-mc-accent-red text-white rounded-lg font-medium hover:bg-mc-accent-red/90 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddMemoryModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<MemoryType | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          type: type || undefined,
        }),
      });

      if (res.ok) {
        onAdded();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add memory');
      }
    } catch {
      setError('Failed to add memory');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl max-w-md w-full">
        <div className="p-6 border-b border-mc-border">
          <h2 className="text-lg font-semibold">Add Memory Entry</h2>
          <p className="text-sm text-mc-text-secondary mt-1">Add a note to your memory timeline</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Type (optional)</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType | '')}
              className="w-full bg-mc-bg border border-mc-border rounded-lg px-4 py-2 focus:outline-none focus:border-mc-accent"
            >
              <option value="">No type</option>
              <option value="user">User</option>
              <option value="feedback">Feedback</option>
              <option value="project">Project</option>
              <option value="reference">Reference</option>
            </select>
            <p className="text-xs text-mc-text-secondary mt-1">
              {type === 'user' && 'Information about user role, preferences, or knowledge'}
              {type === 'feedback' && 'Guidance or corrections for future behavior'}
              {type === 'project' && 'Ongoing work, goals, or initiatives'}
              {type === 'reference' && 'Pointers to external resources'}
            </p>
          </div>

          {/* Content textarea */}
          <div>
            <label className="block text-sm font-medium mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your memory note..."
              rows={4}
              className="w-full bg-mc-bg border border-mc-border rounded-lg px-4 py-2 focus:outline-none focus:border-mc-accent resize-none"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-mc-accent-red text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-mc-text-secondary hover:text-mc-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="px-6 py-2 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Memory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
