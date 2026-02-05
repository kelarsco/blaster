import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api.js';

export function DashboardPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    fetch(`${API}/campaigns`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((d) => {
        setCampaigns(d.campaigns || []);
        const total = (d.campaigns || []).length;
        const sent = (d.campaigns || []).reduce((s, c) => s + (c.sent || 0), 0);
        const failed = (d.campaigns || []).reduce((s, c) => s + (c.failed || 0), 0);
        setStats({ total, sent, failed });
      });
    fetch(`${API}/activity/logs?limit=20`)
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => setActivity(d.logs || []));
  }, []);

  const recentCampaigns = campaigns.slice(0, 5);
  const scansFromActivity = activity.filter((l) => l.type === 'scan_complete' || l.type === 'scan_start').slice(0, 5);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-blaster-fg">Dashboard</h1>
          <p className="text-blaster-muted mt-0.5">Overview of your outreach campaigns</p>
        </div>
        <Link
          to="/app/scanner"
          className="inline-flex items-center gap-2 btn-blaster-accent shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          New Scan
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Campaigns', value: stats.total, icon: '✈️', color: 'text-blaster-accent' },
          { label: 'Emails Sent', value: stats.sent, icon: '✓', color: 'text-green-600' },
          { label: 'Failed Emails', value: stats.failed, icon: '✕', color: 'text-red-600' },
          { label: 'Emails Extracted', value: '—', icon: '✉️', color: 'text-amber-600', sub: 'From scans' },
        ].map((s) => (
          <div key={s.label} className="bg-blaster-bg-card rounded-xl border border-blaster-border p-5 shadow-sm">
            <div className={`text-2xl font-bold text-blaster-fg ${s.color}`}>{s.value}</div>
            <div className="text-sm text-blaster-muted mt-0.5">{s.label}</div>
            {s.sub && <div className="text-xs text-blaster-muted">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-blaster-fg">Recent Campaigns</h2>
            <Link to="/app/campaigns" className="text-sm font-medium text-blaster-accent hover:underline">
              View all →
            </Link>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="text-center py-8 text-blaster-muted">
              <div className="text-4xl mb-2 opacity-50">✈️</div>
              <p>No campaigns yet</p>
              <Link to="/app/campaigns" className="inline-block mt-3 btn-blaster-accent text-sm">
                Create Campaign
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentCampaigns.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 border-b border-blaster-border last:border-0">
                  <Link to="/app/campaigns" className="text-blaster-fg font-medium truncate">
                    {c.sent}/{c.totalQueued} sent
                  </Link>
                  <span className="text-xs text-blaster-muted capitalize">{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-blaster-fg">Recent Scans</h2>
            <Link to="/app/scanner" className="text-sm font-medium text-blaster-accent hover:underline">
              View all →
            </Link>
          </div>
          {scansFromActivity.length === 0 ? (
            <div className="text-center py-8 text-blaster-muted">
              <div className="text-4xl mb-2 opacity-50">🔍</div>
              <p>No scans yet</p>
              <Link to="/app/scanner" className="inline-block mt-3 btn-blaster-accent text-sm">
                Start Scanning
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {scansFromActivity.map((log, i) => (
                <li key={log.id || i} className="py-2 border-b border-blaster-border last:border-0 text-sm text-blaster-muted">
                  {log.type === 'scan_complete' ? 'Scan completed' : 'Scan started'} — {log.payload?.scanId ? String(log.payload.scanId).slice(0, 8) : '—'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
