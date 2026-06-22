import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';
import { ResourceTypeToggle } from '../components/resources/ResourceTypeToggle.jsx';
import { ResourceSortButton } from '../components/resources/ResourceSortButton.jsx';
import { VideoResourceCard } from '../components/resources/VideoResourceCard.jsx';
import { DocumentResourceCard } from '../components/resources/DocumentResourceCard.jsx';
import { useStaleWhileRevalidate } from '../hooks/useStaleWhileRevalidate.js';

export function ResourcesPage() {
  const { authFetch, user } = useAuth();
  const [tab, setTab] = useState('video');
  const [sortOrder, setSortOrder] = useState('newest');

  const fetchResources = useCallback(async () => {
    const res = await authFetch(`${API}/resources?type=${tab}`);
    if (!res.ok) return { resources: [] };
    const data = await res.json().catch(() => ({}));
    return { resources: Array.isArray(data?.resources) ? data.resources : [] };
  }, [authFetch, tab]);

  const { data, loading } = useStaleWhileRevalidate(`resources:${tab}`, fetchResources, {
    userId: user?.id,
    enabled: Boolean(authFetch),
  });

  const resources = data?.resources ?? [];

  const sortedResources = useMemo(() => {
    const items = [...resources];
    items.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });
    return items;
  }, [resources, sortOrder]);

  const hasResources = sortedResources.length > 0;
  const emptyLabel = tab === 'video' ? 'No videos yet' : 'No PDFs yet';

  return (
    <div className="min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Resources</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          Guides, workflows, tips, and best practices for wiblaster
        </p>
      </div>

      <div className="max-w-5xl">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-blaster-border bg-white mb-6">
          <ResourceTypeToggle value={tab} onChange={setTab} embedded />
          <ResourceSortButton order={sortOrder} onChange={setSortOrder} />
        </div>

        {loading ? (
          <p className="text-sm text-blaster-muted py-8 text-center">Loading…</p>
        ) : hasResources ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            {sortedResources.map((resource) =>
              tab === 'video' ? (
                <VideoResourceCard key={resource.id} resource={resource} />
              ) : (
                <DocumentResourceCard key={resource.id} resource={resource} />
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-blaster-muted text-center py-8">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
