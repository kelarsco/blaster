import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

function RefreshIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

const REFRESH_SPIN_MS = 1200;

export function ExecutionDashboard({ campaignId, onClose }) {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!authFetch) {
      setLoading(false);
      return;
    }
    try {
      const res = await authFetch(`${API}/campaigns/${campaignId}`);
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (_) {}
    setLoading(false);
  }, [authFetch, campaignId]);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 2000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const pause = async () => {
    if (!authFetch) return;
    await authFetch(`${API}/campaigns/${campaignId}/pause`, { method: 'POST' });
    if (stats) setStats({ ...stats, status: 'paused' });
  };
  const resume = async () => {
    if (!authFetch) return;
    const res = await authFetch(`${API}/campaigns/${campaignId}/resume`, { method: 'POST' });
    if (res.ok && stats) setStats({ ...stats, status: 'running' });
  };
  const stop = async () => {
    if (!authFetch) return;
    await authFetch(`${API}/campaigns/${campaignId}/stop`, { method: 'POST' });
    if (stats) setStats({ ...stats, status: 'stopped' });
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await resume();
    setTimeout(() => setRefreshing(false), REFRESH_SPIN_MS);
  };

  const formatStartedAt = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const clearError = async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API}/campaigns/${campaignId}/clear-error`, { method: 'POST' });
      if (res.ok && stats) setStats({ ...stats, lastError: null });
    } catch (_) {}
  };

  if (loading && !stats) {
    return (
      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-sm card-body-mobile">
        <p className="text-sm text-blaster-muted">Loading campaign…</p>
      </section>
    );
  }

  return (
    <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-sm card-body-mobile">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="card-title-mobile">Campaign</h2>
          {stats?.createdAt && (
            <p className="text-xs text-blaster-muted mt-0.5">Started {formatStartedAt(stats.createdAt)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-border/50 transition"
          aria-label="Close"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
      <div className="flex items-center gap-4 mb-3 text-sm">
        <span className="text-blaster-muted">
          <span className="font-medium text-blaster-fg">{stats?.totalQueued ?? 0}</span> Queued
        </span>
        <span className="text-blaster-muted">
          <span className="font-medium text-emerald-600">{stats?.sent ?? 0}</span> Sent
        </span>
        <span className="text-blaster-muted">
          <span className="font-medium text-red-500">{stats?.failed ?? 0}</span> Failed
        </span>
        <span className="text-blaster-muted capitalize">
          {stats?.status === 'running' && (stats?.sent ?? 0) >= (stats?.totalQueued ?? 0) ? 'completed' : (stats?.status ?? '—')}
        </span>
      </div>
      {stats?.lastError && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-red-800 dark:text-red-200">Last error</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5 truncate" title={stats.lastError}>{stats.lastError}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="shrink-0 p-0.5 rounded text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
            aria-label="Clear error"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}
      {((stats?.status === 'running' && (stats?.sent ?? 0) < (stats?.totalQueued ?? 1)) || stats?.status === 'paused') && (
        <div className="flex items-center gap-2 flex-wrap">
          {stats?.status === 'running' && (
            <>
              <button
                type="button"
                onClick={pause}
                className="text-sm text-blaster-muted hover:text-blaster-fg transition"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-border/50 transition disabled:opacity-80 disabled:pointer-events-none"
                title="Continue or retry sending (e.g. after network delay)"
                aria-label="Refresh / continue sending"
              >
                <RefreshIcon key={refreshing ? 'spin' : 'idle'} className={`w-4 h-4 ${refreshing ? 'animate-refresh-spin' : ''}`} />
              </button>
            </>
          )}
          {stats?.status === 'paused' && (
            <>
              <button
                type="button"
                onClick={resume}
                className="text-sm px-3 py-1.5 rounded-lg bg-blaster-accent !text-white hover:opacity-90 transition"
              >
                Continue Campaign
              </button>
              <button
                type="button"
                onClick={stop}
                className="text-sm px-3 py-1.5 rounded-lg border border-blaster-border text-blaster-muted hover:text-red-600 hover:border-red-300 transition"
              >
                Stop Campaign
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
