import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext';

const RANGE_PRESETS = [
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'this_year', label: 'This year' },
  { id: 'all_time', label: 'All time' },
];

function getRangeForPreset(preset) {
  const now = new Date();
  let start = '';
  let end = now.toISOString().slice(0, 10);
  switch (preset) {
    case 'last_7_days':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      break;
    case 'last_30_days':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      break;
    case 'this_year':
      start = `${now.getFullYear()}-01-01`;
      break;
    case 'all_time':
    default:
      start = '';
      end = '';
      break;
  }
  return { start, end };
}

export function AdminSubscriptionsPage() {
  const { adminFetch } = useAdmin();
  const [subscriptions, setSubscriptions] = useState([]);
  const [totalRevenueCents, setTotalRevenueCents] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState('this_year');
  const [dateRange, setDateRange] = useState(() => getRangeForPreset('this_year'));
  const [planFilter, setPlanFilter] = useState('');
  const [plans, setPlans] = useState([]);

  const fetchPlans = useCallback(() => {
    adminFetch('/plans')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
  }, [adminFetch]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const fetchSubscriptions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange.start) params.set('start', dateRange.start);
    if (dateRange.end) params.set('end', dateRange.end);
    if (planFilter) params.set('plan', planFilter);
    const qs = params.toString();
    adminFetch(`/subscriptions${qs ? '?' + qs : ''}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        setSubscriptions(d.subscriptions || []);
        setTotalRevenueCents(d.totalRevenueCents ?? 0);
        setTotalCount(d.totalCount ?? 0);
      })
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  }, [adminFetch, dateRange, planFilter]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    setDateRange(getRangeForPreset(rangePreset));
  }, [rangePreset]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-blaster-fg mb-6">Subscriptions</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex gap-2">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setRangePreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                rangePreset === p.id ? 'bg-blaster-accent text-white' : 'border border-blaster-border text-blaster-muted hover:bg-blaster-border/30'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-blaster-border bg-blaster-input-bg text-blaster-fg text-sm"
          />
          <span className="text-blaster-muted">–</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-blaster-border bg-blaster-input-bg text-blaster-fg text-sm"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-blaster-border bg-blaster-input-bg text-blaster-fg text-sm"
        >
          <option value="">All plans</option>
          {(plans || []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-blaster-border bg-blaster-bg-card p-6">
          <p className="text-sm text-blaster-muted">Total revenue (filtered)</p>
          <p className="text-2xl font-bold text-blaster-fg mt-1">${(totalRevenueCents / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-blaster-border bg-blaster-bg-card p-6">
          <p className="text-sm text-blaster-muted">Subscribers count</p>
          <p className="text-2xl font-bold text-blaster-fg mt-1">{totalCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-blaster-border/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-blaster-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-blaster-bg-app border-b border-blaster-border">
              <tr>
                <th className="text-left p-3 font-medium text-blaster-fg">User</th>
                <th className="text-left p-3 font-medium text-blaster-fg">Plan</th>
                <th className="text-left p-3 font-medium text-blaster-fg">Amount</th>
                <th className="text-left p-3 font-medium text-blaster-fg">Period end</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-blaster-muted">No subscriptions match the filter</td></tr>
              ) : (
                subscriptions.map((s) => (
                  <tr key={s.id} className="border-b border-blaster-border last:border-0">
                    <td className="p-3 text-blaster-fg">{s.userName || s.userEmail}</td>
                    <td className="p-3 text-blaster-fg">{s.planName}</td>
                    <td className="p-3 text-blaster-fg">${(s.amount / 100).toFixed(2)}/{s.interval}</td>
                    <td className="p-3 text-blaster-muted">{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
