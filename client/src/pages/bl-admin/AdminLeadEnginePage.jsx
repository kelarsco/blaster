import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, RefreshCw, Trash2 } from 'react-feather';
import { useAdmin } from '../../context/AdminContext.jsx';
import {
  AdminPageHeader,
  AdminButton,
  AdminStatGrid,
  AdminPanel,
  AdminBadge,
  adminGhostBtn,
  adminPrimaryBtn,
} from '../../components/admin';

function statusVariant(status, qualified) {
  if (qualified || status === 'qualified') return 'qualified';
  return status || 'default';
}

export function AdminLeadEnginePage() {
  const { adminFetch } = useAdmin();
  const [stats, setStats] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requeueing, setRequeueing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

    run();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [load]);

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
          ? `${count.toLocaleString()} rejected store${count === 1 ? '' : 's'} queued for re-checking.`
          : 'No rejected stores to re-check.'
      );
      load();
    } catch (e) {
      setMessage(e.message || 'Re-check failed');
    }
    setRequeueing(false);
  };

  const deleteByStatus = async (status) => {
    const count = status === 'rejected' ? (stats?.rejected ?? 0) : (stats?.failed ?? 0);
    if (count === 0) return;
    const label = status === 'rejected' ? 'rejected' : 'failed';
    const confirmed = window.confirm(
      `Permanently delete ${count.toLocaleString()} ${label} store${count === 1 ? '' : 's'} from the database? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setMessage('');
    try {
      const res = await adminFetch('/lead-engine/stores/delete-by-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to delete ${label} stores`);
      const removed = data.deleted ?? 0;
      setMessage(
        removed > 0
          ? `Deleted ${removed.toLocaleString()} ${label} store${removed === 1 ? '' : 's'}.`
          : `No ${label} stores to delete.`
      );
      load();
    } catch (e) {
      setMessage(e.message || 'Delete failed');
    }
    setDeleting(false);
  };

  if (loading) {
    return <p className="text-sm text-blaster-muted">Loading lead engine…</p>;
  }

  const cards = [
    { id: 'all', label: 'Total tracked', value: stats?.total ?? 0 },
    { id: 'qualified', label: 'Qualified (on Leads page)', value: stats?.qualified ?? 0 },
    { id: 'pending', label: 'Pending pipeline', value: stats?.pending ?? 0 },
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

  const statItems = cards.map((c) => ({
    label: c.label,
    value: c.value.toLocaleString(),
    onClick: () => setStatusFilter(c.id),
    active: statusFilter === c.id,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Lead Engine"
        subtitle="Track stores, run the qualification pipeline, and publish qualified leads to the Store Leads page."
        actions={
          <>
            <AdminButton to="/bl-admin/lead-engine/add">
              <Plus className="w-4 h-4" />
              Add leads
            </AdminButton>
            <Link to="/bl-admin/lead-engine/scrape" className={adminGhostBtn}>
              <Play className="w-4 h-4" />
              Start scraping
            </Link>
            <button type="button" onClick={load} className={adminGhostBtn} aria-label="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        }
      />

      {message ? (
        <p className="text-sm text-blaster-muted bg-blaster-bg-card border border-blaster-border rounded-xl px-4 py-3 shadow-sm">
          {message}
        </p>
      ) : null}

      <AdminStatGrid items={statItems} columns={5} />

      <AdminPanel
        title={activeCard?.id === 'all' ? 'All tracked stores' : activeCard?.label}
        actions={
          statusFilter === 'rejected' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={requeueRejected}
                disabled={requeueing || deleting || (stats?.rejected ?? 0) === 0}
                className={`${adminGhostBtn} !text-xs !py-1.5`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${requeueing ? 'animate-spin' : ''}`} />
                {requeueing ? 'Re-checking…' : 'Re-check rejected'}
              </button>
              <button
                type="button"
                onClick={() => deleteByStatus('rejected')}
                disabled={deleting || requeueing || (stats?.rejected ?? 0) === 0}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 px-3 py-1.5 rounded-full border border-red-200 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting…' : 'Delete rejected'}
              </button>
            </div>
          ) : statusFilter === 'failed' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => deleteByStatus('failed')}
                disabled={deleting || (stats?.failed ?? 0) === 0}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 px-3 py-1.5 rounded-full border border-red-200 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting…' : 'Delete failed'}
              </button>
              <button type="button" onClick={() => setStatusFilter('all')} className={`${adminGhostBtn} !text-xs !py-1.5`}>
                Show all
              </button>
            </div>
          ) : statusFilter !== 'all' ? (
            <button type="button" onClick={() => setStatusFilter('all')} className={`${adminGhostBtn} !text-xs !py-1.5`}>
              Show all
            </button>
          ) : null
        }
      >
        <p className="px-4 py-2 text-xs text-blaster-muted border-b border-blaster-border/60">
          {filteredStores.length.toLocaleString()} store{filteredStores.length === 1 ? '' : 's'}
          {statusFilter === 'qualified'
            ? ' · shown on the public Leads page when qualified'
            : statusFilter === 'rejected'
              ? ' · re-check or delete rejected stores'
              : statusFilter === 'failed'
                ? ' · delete failed stores to clear pipeline errors'
                : statusFilter !== 'all'
                  ? ` · ${activeCard?.label}`
                  : ' · click a stat above to filter'}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-blaster-muted border-b border-blaster-border">
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Phase</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blaster-border/60">
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
                  <tr key={s.id} className="hover:bg-blaster-sidebar-hover/30 transition-colors">
                    <td className="px-4 py-3 max-w-xs truncate">
                      <a href={s.storeUrl} target="_blank" rel="noopener noreferrer" className="text-blaster-fg hover:underline">
                        {s.storeUrl}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge variant={statusVariant(s.status, s.qualified)}>
                        {s.qualified ? 'qualified' : s.status}
                      </AdminBadge>
                    </td>
                    <td className="px-4 py-3 text-blaster-muted">{s.currentPhase ?? 0}</td>
                    <td className="px-4 py-3">{s.activeScore ?? '—'}</td>
                    <td className="px-4 py-3">{s.platform || '—'}</td>
                    <td className="px-4 py-3">{s.countryCode || '—'}</td>
                    <td className="px-4 py-3">{s.productCount ?? '—'}</td>
                    <td className="px-4 py-3 text-blaster-muted">{s.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
