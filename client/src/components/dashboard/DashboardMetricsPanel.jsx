import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Zap, Percent, TrendingUp, TrendingDown, Minus, Mail, Eye, X } from 'react-feather';
import { StreaksAndBadgesPanel } from './DashboardSections.jsx';
import { RecentActivityList } from './RecentActivityList.jsx';

function MetricIcon({ name }) {
  const cls = 'w-4 h-4 text-blaster-muted';
  if (name === 'layers') return <Layers className={cls} strokeWidth={1.75} />;
  if (name === 'zap') return <Zap className={cls} strokeWidth={1.75} />;
  if (name === 'mail') return <Mail className={cls} strokeWidth={1.75} />;
  if (name === 'store') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  return <Percent className={cls} strokeWidth={1.75} />;
}

const RANGE_OPTIONS = ['24h', '7d', '31d', 'All'];

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-blaster-border/50 ${className}`} />;
}

function TrendBadge({ trend }) {
  const { label, direction } = trend || { label: 'N/A', direction: 'neutral' };
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  if (direction === 'up') {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-700`}>
        <TrendingUp className="w-3 h-3" />
        {label}
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className={`${base} bg-red-50 text-red-600`}>
        <TrendingDown className="w-3 h-3" />
        {label}
      </span>
    );
  }
  return (
    <span className={`${base} bg-gray-100 text-blaster-muted`}>
      <Minus className="w-3 h-3" />
      {label}
    </span>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatViewedTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function storeLabel(storeUrl, email) {
  const url = String(storeUrl || '').trim();
  if (url) {
    try {
      const host = url.replace(/^https?:\/\//i, '').split('/')[0];
      if (host) return host;
    } catch (_) {}
    return url;
  }
  const domain = String(email || '').split('@')[1];
  return domain || 'Unknown store';
}

function MetricCell({ item, onAction }) {
  const base =
    'p-5 sm:p-6 block w-full text-left transition';
  const interactive = item.to || item.action
    ? 'cursor-pointer hover:bg-gradient-to-br hover:from-blaster-accent/[0.04] hover:to-blaster-orange/[0.05]'
    : '';

  const content = (
    <>
      {item.icon ? (
        <div className="flex items-center gap-2 mb-4">
          <MetricIcon name={item.icon} />
          <span className="text-sm text-blaster-muted">{item.label}</span>
        </div>
      ) : (
        <p className="text-sm text-blaster-muted mb-3">{item.label}</p>
      )}
      <div className={`flex ${item.icon ? 'items-end justify-between' : 'flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'} gap-3`}>
        <p className={`${item.icon ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'} font-semibold text-blaster-fg tracking-tight`}>
          {item.value}
        </p>
        <TrendBadge trend={item.trend} />
      </div>
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} className={`${base} ${interactive}`}>
        {content}
      </Link>
    );
  }

  if (item.action) {
    return (
      <button
        type="button"
        onClick={() => onAction?.(item.action)}
        className={`${base} ${interactive}`}
      >
        {content}
      </button>
    );
  }

  return <div className={base}>{content}</div>;
}

function ViewedMessagesModal({ items, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-[1px] bg-gradient-to-br from-blaster-accent/25 via-blaster-accent/12 to-blaster-orange/30 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col rounded-2xl bg-white overflow-hidden max-h-[85vh]">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tl from-blaster-orange/[0.05] via-blaster-accent/[0.03] to-transparent"
            aria-hidden
          />
          <div className="relative flex items-center justify-between px-5 py-4 border-b border-blaster-border shrink-0">
            <div>
              <h3 className="text-base font-semibold text-blaster-fg">Viewed messages</h3>
              <p className="text-xs text-blaster-muted mt-0.5">Emails opened by recipients</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative overflow-y-auto flex-1 divide-y divide-blaster-border/70">
            {items.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-blaster-muted">No viewed messages yet</p>
            ) : (
              items.map((item, i) => (
                <div key={`${item.email}-${item.openedAt}-${i}`} className="px-5 py-4 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blaster-accent/10 to-blaster-orange/15 border border-blaster-accent/15">
                    <Eye className="w-4 h-4 text-blaster-accent" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-blaster-fg truncate">{storeLabel(item.storeUrl, item.email)}</p>
                    <p className="text-sm text-blaster-muted truncate mt-0.5">{item.email}</p>
                    {item.storeUrl ? (
                      <p className="text-xs text-blaster-muted/80 truncate mt-0.5">{item.storeUrl}</p>
                    ) : null}
                    <p className="text-xs text-blaster-muted mt-1.5">{formatViewedTime(item.openedAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardMetricsPanel({
  loading,
  metrics,
  range,
  onRangeChange,
  showPageHeader = true,
  showCreateButton = true,
  showCampaigns = true,
  showActivity = true,
  showStreaks = false,
  streaksAndBadges = null,
  recentFeed = null,
  onSetTarget,
  settingTarget = false,
  pageTitle = 'Dashboard',
  pageSubtitle = "Welcome back — here's your personalized setup guide.",
  userName,
  outerBgClass = 'bg-blaster-sidebar',
}) {
  const [viewedModalOpen, setViewedModalOpen] = useState(false);
  const greeting = userName ? `Welcome, ${userName}` : 'Welcome back';

  const handleMetricAction = (action) => {
    if (action === 'viewedMessages') setViewedModalOpen(true);
  };

  return (
    <div className={`min-h-full ${outerBgClass} p-4 sm:p-6 md:p-8`}>
      <div className="bg-white rounded-2xl border border-blaster-border overflow-hidden">
        {showPageHeader && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 sm:px-6 py-5 border-b border-blaster-border">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-blaster-fg">{pageTitle}</h1>
              <p className="text-sm text-blaster-muted mt-1">{pageSubtitle || greeting}</p>
            </div>
            {showCreateButton && (
              <Link
                to="/app/campaigns"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blaster-nav-active text-white text-sm font-medium hover:opacity-90 transition shrink-0"
              >
                <span className="text-lg leading-none">+</span>
                Create campaign
              </Link>
            )}
          </div>
        )}

        {/* Overview */}
        <div className="border-b border-blaster-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-b border-blaster-border">
            <div>
              <h2 className="text-base font-semibold text-blaster-fg">Overview</h2>
              <p className="text-xs text-blaster-muted mt-0.5">Key metrics across your scans and campaigns</p>
            </div>
            <div className="inline-flex rounded-full border border-blaster-border bg-white p-0.5 self-start sm:self-auto">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onRangeChange?.(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    range === opt
                      ? 'bg-blaster-nav-active text-white'
                      : 'text-blaster-muted hover:text-blaster-fg'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`p-5 sm:p-6 ${i < 4 ? 'border-b sm:border-b-0 border-blaster-border' : ''} ${i % 2 === 0 ? 'sm:border-l' : ''} ${i > 0 ? 'lg:border-l' : ''} lg:border-blaster-border`}
                >
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-blaster-border">
              {metrics.overview.map((item) => (
                <MetricCell key={item.key} item={item} onAction={handleMetricAction} />
              ))}
            </div>
          )}
        </div>

        {/* App data */}
        <div className="border-b border-blaster-border">
          <div className="px-5 sm:px-6 py-4 border-b border-blaster-border">
            <h2 className="text-base font-semibold text-blaster-fg">App datas</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-blaster-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 sm:p-6 border-t border-blaster-border first:border-t-0 sm:border-t-0">
                  <Skeleton className="h-4 w-20 mb-4" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-blaster-border">
              {metrics.performance.map((item) => (
                <MetricCell key={item.key} item={item} onAction={handleMetricAction} />
              ))}
            </div>
          )}
        </div>

        {showCampaigns && (
          <div className={`${showStreaks || showActivity ? 'border-b border-blaster-border' : ''}`}>
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-blaster-border">
              <h2 className="text-base font-semibold text-blaster-fg">Recent campaigns</h2>
              <Link to="/app/campaigns" className="text-xs font-medium text-blaster-accent hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="divide-y divide-blaster-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-5 sm:px-6 py-4 flex justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : metrics.recentCampaigns.length === 0 ? (
              <div className="px-5 sm:px-6 py-10 text-center">
                <p className="text-sm text-blaster-muted mb-4">No campaigns yet</p>
                <Link
                  to="/app/scanner"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-blaster-accent text-white text-sm font-medium hover:bg-blaster-accent-hover transition"
                >
                  Start your first scan
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-blaster-border">
                {metrics.recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="text-sm font-medium text-blaster-fg">
                        {campaign.name || `Campaign ${campaign.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-blaster-muted">
                        {campaign.totalQueued || 0} contacts · {campaign.sent || 0} sent
                        {campaign.status && campaign.status !== 'list' ? ` · ${campaign.status}` : ''}
                      </p>
                    </div>
                    <p className="text-xs text-blaster-muted">{formatTime(campaign.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showStreaks && (
          <div className={showActivity ? 'border-b border-blaster-border' : ''}>
            <StreaksAndBadgesPanel
              streaksAndBadges={streaksAndBadges}
              loading={loading}
              fullWidth
              onSetTarget={onSetTarget}
              settingTarget={settingTarget}
            />
          </div>
        )}

        {showActivity && (
          <div>
            <div className="px-5 sm:px-6 py-4 border-b border-blaster-border">
              <h2 className="text-base font-semibold text-blaster-fg">Recent activity</h2>
              <p className="text-xs text-blaster-muted mt-0.5">Latest scans and actions</p>
            </div>
            {loading ? (
              <RecentActivityList items={[]} loading />
            ) : (recentFeed?.length ? recentFeed : metrics.recentActivity).length === 0 ? (
              <div className="px-5 sm:px-6 py-10 text-center text-sm text-blaster-muted">No recent activity</div>
            ) : (
              <RecentActivityList items={recentFeed?.length ? recentFeed : metrics.recentActivity} />
            )}
          </div>
        )}
      </div>

      {viewedModalOpen ? (
        <ViewedMessagesModal
          items={metrics.viewedDetails || []}
          onClose={() => setViewedModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
