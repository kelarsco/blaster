import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';
import { ResourceTypeToggle } from '../components/resources/ResourceTypeToggle.jsx';
import { ResourceSortButton } from '../components/resources/ResourceSortButton.jsx';
import { VideoResourceCard } from '../components/resources/VideoResourceCard.jsx';
import { DocumentResourceCard } from '../components/resources/DocumentResourceCard.jsx';

export function ResourcesPage() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState('video');
  const [sortOrder, setSortOrder] = useState('newest');
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchResources = useCallback(() => {
    if (!authFetch) return;
    setLoading(true);
    authFetch(`${API}/resources?type=${tab}`)
      .then((r) => (r.ok ? r.json() : { resources: [] }))
      .then((data) => setResources(Array.isArray(data?.resources) ? data.resources : []))
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, [authFetch, tab]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

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
