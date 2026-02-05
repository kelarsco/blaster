import React, { useState, useEffect } from 'react';
import { API } from '../api.js';

export function ExecutionDashboard({ campaignId, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API}/campaigns/${campaignId}`);
        const data = await res.json();
        if (res.ok) setStats(data);
      } catch (_) {}
      setLoading(false);
    };
    fetchStats();
    const id = setInterval(fetchStats, 2000);
    return () => clearInterval(id);
  }, [campaignId]);

  const pause = () => fetch(`${API}/campaigns/${campaignId}/pause`, { method: 'POST' });
  const resume = () => fetch(`${API}/campaigns/${campaignId}/resume`, { method: 'POST' });
  const stop = () => fetch(`${API}/campaigns/${campaignId}/stop`, { method: 'POST' });

  if (loading && !stats) {
    return (
      <section className="glass rounded-2xl p-6">
        <p className="text-slate-500 dark:text-slate-400">Loading campaign…</p>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Campaign</h2>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="glass-subtle rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats?.totalQueued ?? 0}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Queued</div>
        </div>
        <div className="glass-subtle rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats?.sent ?? 0}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Sent</div>
        </div>
        <div className="glass-subtle rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-500 dark:text-red-400">{stats?.failed ?? 0}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Failed</div>
        </div>
        <div className="glass-subtle rounded-xl p-4 text-center">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400 capitalize">{stats?.status ?? '—'}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Status</div>
        </div>
      </div>
      {stats?.lastError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">Last error</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{stats.lastError}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Fix the sender in Automation Setup (SMTP user + App Password), then start a new campaign.</p>
        </div>
      )}
      <div className="flex gap-2">
        {stats?.status === 'running' && (
          <button type="button" onClick={pause} className="btn-secondary">Pause</button>
        )}
        {stats?.status === 'paused' && (
          <button type="button" onClick={resume} className="btn-primary">Resume</button>
        )}
        {(stats?.status === 'running' || stats?.status === 'paused') && (
          <button type="button" onClick={stop} className="btn-danger">Stop</button>
        )}
      </div>
    </section>
  );
}
