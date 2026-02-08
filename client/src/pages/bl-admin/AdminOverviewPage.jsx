import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';

export function AdminOverviewPage() {
  const { adminFetch } = useAdmin();
  const [stats, setStats] = useState({ totalUsers: 0, totalSubscribers: 0, totalRevenueCents: 0, activeSubscriptions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/overview')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminFetch]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-blaster-border/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total users', value: stats.totalUsers },
    { label: 'Active subscribers', value: stats.totalSubscribers },
    { label: 'Total revenue (period)', value: `$${(stats.totalRevenueCents / 100).toFixed(2)}` },
    { label: 'Active subscriptions', value: stats.activeSubscriptions },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-blaster-fg mb-6">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-blaster-border bg-blaster-bg-card p-6">
            <p className="text-sm text-blaster-muted">{label}</p>
            <p className="text-2xl font-bold text-blaster-fg mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
