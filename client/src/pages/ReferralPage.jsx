import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  MousePointer,
  UserPlus,
  TrendingUp,
  Share2,
  Users,
  Check,
  X,
  Award,
  Star,
  Link as LinkIcon,
} from 'react-feather';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { API } from '../api.js';
import { formatUTCDateOnly } from '../utils/dateUtils';
import { buildReferralSignupUrl, sanitizeReferralUrl } from '../utils/referralUrl.js';
import { ReferralPageSkeleton } from '../components/referral/ReferralPageSkeleton.jsx';
import { BrandGradientIcon, BrandIconBox, CrownIcon } from '../components/BrandGradientIcon.jsx';
import { FeatureLockOverlay } from '../components/access/PlanAccessUI.jsx';
import '../styles/referral-page.css';

const REFERRAL_MESSAGE =
  'Join me on StoreLeads — find verified ecommerce stores and grow your outreach. Sign up with my link:';

const BRAND_ICON_BOX_MUTED = 'bg-gray-50 border border-blaster-border/60';
const BRAND_ICON_BOX_ACTIVE =
  'bg-gradient-to-br from-blaster-accent/25 to-indigo-50 border border-blaster-accent/45';
const BRAND_ICON_BOX_PROGRESS =
  'bg-gradient-to-br from-blaster-accent/20 to-blaster-orange/25 border border-blaster-accent/30';

function formatLoadError(err) {
  const msg = String(err?.message || err || '');
  if (err?.name === 'TypeError' || /failed to fetch|network|load failed/i.test(msg)) {
    return 'API server is not reachable. Run cd server && npm run dev (or npm run dev from the project root).';
  }
  return msg || 'Failed to load referral program.';
}

function StatCell({ Icon, value, label }) {
  return (
    <div className="px-5 sm:px-6 py-6">
      <div className="flex items-center gap-2.5 mb-3">
        <BrandIconBox>
          <BrandGradientIcon Icon={Icon} />
        </BrandIconBox>
        <p className="text-sm text-blaster-muted">{label}</p>
      </div>
      <p className="text-2xl sm:text-3xl font-semibold text-blaster-fg tracking-tight">{value}</p>
    </div>
  );
}

function TierIcon({ tier, status }) {
  const boxClass =
    status === 'locked'
      ? BRAND_ICON_BOX_MUTED
      : status === 'claimed'
        ? BRAND_ICON_BOX_ACTIVE
        : BRAND_ICON_BOX_PROGRESS;

  const iconMuted = status === 'locked';

  if (tier === 3) {
    const id = React.useId().replace(/:/g, '');
    const gradientId = `tier-crown-${id}`;
    return (
      <div className={`referral-tier-icon-wrap ${boxClass}`}>
        {!iconMuted ? (
          <>
            <svg width="0" height="0" className="absolute" aria-hidden>
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#fcb04c" />
                </linearGradient>
              </defs>
            </svg>
            <CrownIcon className="w-5 h-5" stroke={`url(#${gradientId})`} />
          </>
        ) : (
          <CrownIcon className="w-5 h-5 text-gray-300" />
        )}
      </div>
    );
  }

  const Icon = tier === 1 ? Award : Star;
  return (
    <div className={`referral-tier-icon-wrap ${boxClass}`}>
      {iconMuted ? (
        <Icon className="w-5 h-5 text-gray-300" strokeWidth={1.75} />
      ) : (
        <BrandGradientIcon Icon={Icon} className="w-5 h-5" />
      )}
    </div>
  );
}

function TierStatusPill({ status }) {
  if (status === 'claimed') {
    return (
      <span className="referral-status-pill referral-status-claimed">
        <Check className="w-3 h-3" strokeWidth={3} /> Claimed
      </span>
    );
  }
  if (status === 'in_progress') {
    return <span className="referral-status-pill referral-status-progress">In Progress</span>;
  }
  return <span className="referral-status-pill referral-status-locked">Locked</span>;
}

export function ReferralPage() {
  const { authFetch, user, loading: authLoading } = useAuth();
  const { access } = usePlanAccess();
  const referralLocked = access?.referral ?? false;
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 10;

  const loadReferral = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError('Sign in to view your referral program.');
      setData(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authFetchRef.current(`${API}/referral/me`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Could not load referral data (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setData(null);
      setError(formatLoadError(e));
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    loadReferral();
  }, [loadReferral]);

  const referralUrl = useMemo(() => {
    const code = data?.referralCode || '';
    if (code) return buildReferralSignupUrl(code);
    return sanitizeReferralUrl(data?.referralUrl, code);
  }, [data?.referralCode, data?.referralUrl]);
  const shareText = `${REFERRAL_MESSAGE} ${referralUrl}`;

  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const paginatedReferrals = useMemo(() => {
    const list = data?.referrals || [];
    const start = page * perPage;
    return list.slice(start, start + perPage);
  }, [data?.referrals, page]);

  const totalPages = Math.ceil((data?.referrals?.length || 0) / perPage) || 1;
  const progressPercent = Math.min(100, data?.progressPercent ?? 0);
  const upgradeCount = data?.upgradeCount ?? 0;

  if (authLoading || loading) {
    return <ReferralPageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-full bg-white p-4 sm:p-6 md:p-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-blaster-fg">Referral Program</h1>
            <p className="text-sm text-blaster-muted mt-1 max-w-2xl">
              Invite friends to wiblaster. Earn premium access when they upgrade.
            </p>
          </div>
          <div className="rounded-2xl border border-blaster-border bg-white p-5 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              className="referral-btn referral-btn-primary mt-4 mx-auto"
              onClick={() => loadReferral()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-blaster-fg">Referral Program</h1>
          <p className="text-sm text-blaster-muted mt-1 max-w-2xl">
            Invite friends to wiblaster. Earn premium access when they upgrade.
          </p>
        </div>

        {referralLocked ? (
          <FeatureLockOverlay
            message="Upgrade to access your referral dashboard."
            minHeight="min(60vh, 28rem)"
            className="rounded-2xl border border-blaster-border"
          />
        ) : (
        <>
        <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-blaster-border">
            <div className="flex items-center gap-2.5">
              <BrandIconBox>
                <BrandGradientIcon Icon={LinkIcon} />
              </BrandIconBox>
              <div>
                <p className="text-base font-semibold text-blaster-fg">Your referral link</p>
                <p className="text-xs text-blaster-muted mt-0.5">Share this link to track signups and upgrades</p>
              </div>
            </div>
          </div>
          <div className="px-5 sm:px-6 py-4">
            <div className="referral-link-row relative">
              <input type="text" readOnly className="referral-link-input" value={referralUrl} aria-label="Referral URL" />
              <button
                type="button"
                className={`referral-btn ${copied ? 'referral-btn-success' : 'referral-btn-cta'}`}
                onClick={copyLink}
              >
                <Copy className="w-4 h-4" strokeWidth={2} />
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <div className="relative">
                <button type="button" className="referral-btn referral-btn-secondary" onClick={() => setShareOpen((o) => !o)} aria-expanded={shareOpen}>
                  <Share2 className="w-4 h-4" strokeWidth={2} />
                  Share
                </button>
                {shareOpen && (
                  <div className="referral-share-menu">
                    <button
                      type="button"
                      onClick={() => {
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
                        setShareOpen(false);
                      }}
                    >
                      Twitter / X
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
                        setShareOpen(false);
                      }}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `mailto:?subject=${encodeURIComponent('Join StoreLeads')}&body=${encodeURIComponent(shareText)}`;
                        setShareOpen(false);
                      }}
                    >
                      Email
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-blaster-border">
            <StatCell
              Icon={MousePointer}
              value={(data?.linkClicks ?? 0).toLocaleString()}
              label="Total Link Clicks"
            />
            <StatCell
              Icon={UserPlus}
              value={(data?.signupCount ?? 0).toLocaleString()}
              label="Signups via Your Link"
            />
            <StatCell
              Icon={TrendingUp}
              value={(data?.upgradeCount ?? 0).toLocaleString()}
              label="Upgrades (Paid)"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-blaster-border">
            <h2 className="text-base font-semibold text-blaster-fg">Achievement Tiers</h2>
            <p className="text-xs text-blaster-muted mt-0.5">Unlock free Premium when referrals upgrade</p>
          </div>
          <div className="referral-tiers">
            {(data?.tiers || []).map((tier) => (
              <div
                key={tier.tier}
                className={`referral-tier-card referral-tier-card--${tier.status === 'in_progress' ? 'in-progress' : tier.status}`}
              >
                <TierIcon tier={tier.tier} status={tier.status} />
                <p className="referral-tier-milestone">{tier.milestoneLabel}</p>
                <p className="referral-tier-reward">{tier.rewardLabel}</p>
                <TierStatusPill status={tier.status} />
                {tier.status === 'claimed' && tier.claimedAt && (
                  <p className="referral-tier-meta">
                    Activated {formatUTCDateOnly(tier.claimedAt)}
                    {tier.expiresAt && ` · Expires ${formatUTCDateOnly(tier.expiresAt)}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-blaster-border">
            <h2 className="text-base font-semibold text-blaster-fg">Referred Users</h2>
            <p className="text-xs text-blaster-muted mt-0.5">People who joined through your link</p>
          </div>
          {!data?.referrals?.length ? (
            <div className="referral-empty">
              <div className="referral-empty-icon">
                <BrandGradientIcon Icon={Users} className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-blaster-fg">You haven&apos;t referred anyone yet</p>
              <p className="text-xs text-blaster-muted mt-1 max-w-sm mx-auto">Share your link to get started.</p>
            </div>
          ) : (
            <>
              <div className="referral-table-wrap">
                <table className="referral-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Email</th>
                      <th>Joined</th>
                      <th>Plan</th>
                      <th>Counts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReferrals.map((row) => (
                      <tr key={row.index}>
                        <td>{row.index}</td>
                        <td>{row.emailMasked}</td>
                        <td>{row.joinedAt ? formatUTCDateOnly(row.joinedAt) : '—'}</td>
                        <td>
                          <span className={row.planStatus === 'Upgraded' ? 'referral-plan-upgraded' : 'referral-plan-free'}>
                            {row.planStatus}
                          </span>
                        </td>
                        <td>
                          {row.countsTowardGoal ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-sm font-medium">
                              <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blaster-muted text-sm">
                              <X className="w-3.5 h-3.5" strokeWidth={2} /> No
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 px-5 py-4 border-t border-blaster-border">
                  <button type="button" className="referral-btn referral-btn-secondary text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <span className="text-xs text-blaster-muted self-center">Page {page + 1} of {totalPages}</span>
                  <button type="button" className="referral-btn referral-btn-secondary text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="referral-progress-section">
          <div className="referral-progress-track-wrap">
            <div className="referral-progress-markers">
              <div className={`referral-marker ${upgradeCount >= 3 ? 'is-achieved' : ''}`}>
                3 Upgrades
                <span className="referral-marker-reward">14 Days Free</span>
              </div>
              <div className={`referral-marker ${upgradeCount >= 6 ? 'is-achieved' : ''}`}>
                6 Upgrades
                <span className="referral-marker-reward">30 Days Free</span>
              </div>
              <div className={`referral-marker ${upgradeCount >= 10 ? 'is-achieved' : ''}`}>
                10 Upgrades
                <span className="referral-marker-reward">60 Days Free</span>
              </div>
            </div>
            <div className="referral-progress-track">
              <div className="referral-progress-fill" style={{ width: `${progressPercent}%` }} />
              <div className="referral-progress-knob" style={{ left: `${progressPercent}%` }} aria-hidden>
                {upgradeCount}
              </div>
            </div>
          </div>
          <p className="referral-progress-message">{data?.progressMessage}</p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
