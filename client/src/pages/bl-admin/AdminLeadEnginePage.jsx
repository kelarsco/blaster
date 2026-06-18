import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, RefreshCw } from 'react-feather';
import { useAdmin } from '../../context/AdminContext.jsx';

function statusBadge(status) {
  const map = {
    qualified: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    rejected: 'bg-gray-100 text-gray-600',
    failed: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

export function AdminLeadEnginePage() {
  const { adminFetch } = useAdmin();
  const [stats, setStats] = useState(null);
  const [stores, setStores] = useState([]);
  const [scrapeJob, setScrapeJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [requeueing, setRequeueing] = useState(false);
  const [reclassifyingTags, setReclassifyingTags] = useState(false);
  const [tagRefreshPending, setTagRefreshPending] = useState(0);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadTagStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/lead-engine/stores/tag-refresh-status');
      if (res.ok) {
        const data = await res.json();
        setTagRefreshPending(data.pending ?? 0);
      }
    } catch (_) {}
  }, [adminFetch]);

  const load = useCallback(async () => {
    let failed = false;
    try {
      const [statsRes, storesRes] = await Promise.all([
        adminFetch('/lead-engine/stats'),
        adminFetch('/lead-engine/stores'),
      ]);
      if (!statsRes.ok || !storesRes.ok) failed = true;
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
        setScrapeJob(data.scrapeJob);
      }
      if (storesRes.ok) {
        const data = await storesRes.json();
        setStores(data.stores || []);
      }
    } catch (_) {
      failed = true;
    }
    setLoading(false);
    return failed;
  }, [adminFetch]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const schedule = (ms) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(run, ms);
    };

    const run = async () => {
      const failed = await load();
      if (!cancelled) schedule(failed ? 120000 : 60000);
    };

    loadTagStatus();
    run();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [load, loadTagStatus]);

  const startScrape = async () => {
    setScraping(true);
    setMessage('');
    try {
      const res = await adminFetch('/lead-engine/scrape/start', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to start scrape');
      setMessage('Scrape job started. New URLs will be discovered and queued for qualification.');
      load();
    } catch (e) {
      setMessage(e.message || 'Scrape failed');
    }
    setScraping(false);
  };

  const requeueRejected = async () => {
    setRequeueing(true);
    setMessage('');
    try {
      const res = await adminFetch('/lead-engine/stores/requeue-rejected', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to re-check rejected stores');
      const count = data.requeued ?? 0;
      setMessage(
        count > 0
          ? `${count.toLocaleString()} rejected store${count === 1 ? '' : 's'} queued for re-checking. They will move to pending/processing as the pipeline runs.`
          : 'No rejected stores to re-check.'
      );
      load();
    } catch (e) {
      setMessage(e.message || 'Re-check failed');
    }
    setRequeueing(false);
  };

  const reclassifyAllTags = async () => {
    setReclassifyingTags(true);
    setMessage('');
    try {
      const res = await adminFetch('/lead-engine/stores/reclassify-tags', {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to refresh store tags');
      setMessage(data.message || 'Refreshing store tags in the background. Store Leads filters will update as each store is processed.');
      setTagRefreshPending(data.pending ?? 0);
    } catch (e) {
      setMessage(e.message || 'Tag refresh failed');
    }
    setReclassifyingTags(false);
  };

  if (loading) {
    return <p className="text-sm text-blaster-muted">Loading lead engine…</p>;
  }

  const cards = [
    { id: 'all', label: 'Total tracked', value: stats?.total ?? 0 },
    { id: 'qualified', label: 'Qualified (on Leads page)', value: stats?.qualified ?? 0 },
    { id: 'pending', label: 'Pending pipeline', value: stats?.pending ?? 0 },
    { id: 'processing', label: 'Processing', value: stats?.processing ?? 0 },
    { id: 'rejected', label: 'Rejected', value: stats?.rejected ?? 0 },
    { id: 'failed', label: 'Failed', value: stats?.failed ?? 0 },
  ];

  const matchesFilter = (store) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'qualified') return store.qualified || store.status === 'qualified';
    return store.status === statusFilter;
  };

  const filteredStores = stores.filter(matchesFilter);
  const activeCard = cards.find((c) => c.id === statusFilter);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-blaster-fg">Lead Engine</h1>
          <p className="text-sm text-blaster-muted mt-1">
            Track stores, run the qualification pipeline, and publish qualified leads to the Store Leads page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/bl-admin/lead-engine/add"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blaster-fg text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add leads
          </Link>
          <button
            type="button"
            onClick={reclassifyAllTags}
            disabled={reclassifyingTags}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blaster-border bg-white hover:bg-blaster-sidebar disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${reclassifyingTags ? 'animate-spin' : ''}`} />
            {reclassifyingTags ? 'Refreshing tags…' : 'Refresh store tags'}
          </button>
          <button
            type="button"
            onClick={startScrape}
            disabled={scraping || scrapeJob?.status === 'running'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blaster-border bg-white hover:bg-blaster-sidebar disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {scraping ? 'Starting…' : 'Start scraping'}
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-blaster-border hover:bg-blaster-sidebar"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-blaster-muted bg-blaster-sidebar border border-blaster-border rounded-lg px-4 py-3">
          {message}
        </p>
      )}

      {scrapeJob && (
        <p className="text-xs text-blaster-muted">
          Last scrape: {scrapeJob.status} — {scrapeJob.urlsFound ?? 0} URLs found, {scrapeJob.storesAdded ?? 0} queued
          {scrapeJob.errorMessage && ` (${scrapeJob.errorMessage})`}
        </p>
      )}

      {tagRefreshPending > 0 && (
        <p className="text-xs text-blaster-muted">
          Tag refresh: {tagRefreshPending.toLocaleString()} qualified store{tagRefreshPending === 1 ? '' : 's'} remaining — Store Leads filters update as each finishes.
        </p>
      )}

      <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-blaster-border">
          {cards.map((c) => {
            const isActive = statusFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={`px-5 sm:px-6 py-5 sm:py-6 text-left transition-colors hover:bg-blaster-sidebar/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blaster-accent/40 ${
                  isActive ? 'bg-blaster-sidebar/80' : ''
                }`}
                aria-pressed={isActive}
              >
                <p className="text-xs sm:text-sm text-blaster-muted">{c.label}</p>
                <p className="text-2xl font-semibold text-blaster-fg mt-1 tracking-tight">{c.value.toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-blaster-border flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-blaster-fg">
              {activeCard?.id === 'all' ? 'All tracked stores' : activeCard?.label}
            </h2>
            <p className="text-xs text-blaster-muted mt-0.5">
              {filteredStores.length.toLocaleString()} store{filteredStores.length === 1 ? '' : 's'}
              {statusFilter === 'qualified'
                ? ' · shown on the public Leads page when qualified'
                : statusFilter === 'rejected'
                  ? ' · re-check to confirm inactive stores were not wrongly rejected'
                  : statusFilter !== 'all'
                    ? ` · ${activeCard?.label}`
                    : ' · click a stat above to filter'}
            </p>
          </div>
          {statusFilter === 'rejected' ? (
            <button
              type="button"
              onClick={requeueRejected}
              disabled={requeueing || (stats?.rejected ?? 0) === 0}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blaster-muted hover:text-blaster-fg px-3 py-1.5 rounded-lg border border-blaster-border hover:bg-blaster-sidebar disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${requeueing ? 'animate-spin' : ''}`} />
              {requeueing ? 'Re-checking…' : 'Re-check rejected'}
            </button>
          ) : statusFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="text-xs font-medium text-blaster-muted hover:text-blaster-fg px-3 py-1.5 rounded-lg border border-blaster-border hover:bg-blaster-sidebar"
            >
              Show all
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blaster-sidebar text-left text-xs text-blaster-muted">
              <tr>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Phase</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Platform</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Products</th>
                <th className="px-4 py-2">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blaster-border">
              {filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-blaster-muted">
                    {stores.length === 0
                      ? 'No stores yet. Add leads manually or start scraping.'
                      : 'No stores in this category.'}
                  </td>
                </tr>
              ) : (
                filteredStores.map((s) => (
                  <tr key={s.id} className="hover:bg-blaster-sidebar/50">
                    <td className="px-4 py-2 max-w-xs truncate">
                      <a href={s.storeUrl} target="_blank" rel="noopener noreferrer" className="text-blaster-fg hover:underline">
                        {s.storeUrl}
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(s.status)}`}>
                        {s.qualified ? 'qualified' : s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-blaster-muted">{s.currentPhase ?? 0}</td>
                    <td className="px-4 py-2">{s.activeScore ?? '—'}</td>
                    <td className="px-4 py-2">{s.platform || '—'}</td>
                    <td className="px-4 py-2">{s.countryCode || '—'}</td>
                    <td className="px-4 py-2">{s.productCount ?? '—'}</td>
                    <td className="px-4 py-2 text-blaster-muted">{s.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
