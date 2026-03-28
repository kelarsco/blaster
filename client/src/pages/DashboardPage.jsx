import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/SupabaseAuthContext.jsx';
import { supabaseAPI } from '../supabase-api.js';
import { Send, Check, X, Mail } from 'react-feather';

const SKELETON_DURATION_MS = 1500;

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-blaster-border/60 ${className}`} />;
}

export default function DashboardPage() {
  const { user, subscription } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [emailsExtracted, setEmailsExtracted] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(1);

  const formatActivityTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const time = d
        .toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        .toLowerCase();
      return `${day} ${time}`;
    } catch {
      return '';
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      const [campaignsData, activityData] = await Promise.all([
        supabaseAPI.getCampaigns(user.id),
        supabaseAPI.getActivity(user.id)
      ]);

      const campaignList = campaignsData.data || [];
      setCampaigns(campaignList);
      setStats({
        total: campaignList.length,
        sent: campaignList.reduce((s, c) => s + (c.sent || 0), 0),
        failed: campaignList.reduce((s, c) => s + (c.failed || 0), 0),
      });
      
      setActivity(activityData.data || []);
      
      // For emails extracted, we'd need to implement this in Supabase
      // For now, using a placeholder
      setEmailsExtracted(0);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, [user]);

  useEffect(() => {
    const minDelay = new Promise((r) => setTimeout(r, SKELETON_DURATION_MS));
    const dataPromise = fetchDashboardData();
    Promise.all([minDelay, dataPromise]).then(() => setLoading(false));
  }, [fetchDashboardData]);

  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 30000); // 30 seconds instead of 4 seconds
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const statsFromCampaigns = {
    total: campaigns.length,
    sent: campaigns.reduce((s, c) => s + (c.sent || 0), 0),
    failed: campaigns.reduce((s, c) => s + (c.failed || 0), 0),
  };

  const recentCampaigns = campaigns.slice(0, 5);
  const scansFromActivity = activity
    .filter((l) => l.type === 'scan_complete' || l.type === 'scan_start')
    .slice(0, 5);
  const isNewUser = recentCampaigns.length === 0 && scansFromActivity.length === 0;

  const onboardingSteps = [
    {
      id: 1,
      title: 'Add your first site',
      time: '2 minutes',
      summary: 'Tell us what to scout so we can start finding leads.',
      body: 'Enter any Shopify, WooCommerce, or BigCommerce store URL. We\'ll extract contact emails from the site and help you start your first campaign.',
      primaryLabel: 'Start Scanning',
      primaryTo: '/app/scanner',
      secondaryLabel: 'Learn more',
    },
    {
      id: 2,
      title: 'Create your first campaign',
      time: '4 minutes',
      summary: 'Turn contacts into a simple, focused campaign.',
      body: 'Use presets or start from scratch to create a campaign. Add your subject line and message once, then reuse it across scans.',
      primaryLabel: 'Create campaign',
      primaryTo: '/app/campaigns',
      secondaryLabel: 'Browse campaigns',
    },
    {
      id: 3,
      title: 'Connect your sending inbox',
      time: '4 minutes',
      summary: 'Connect an email sender so we can send on your behalf.',
      body: 'Hook up a real sending address so Store Scouter can send campaigns for you safely and track results over time.',
      primaryLabel: 'Connect sender',
      primaryTo: '/app/senders',
      secondaryLabel: 'Configure later',
    },
    {
      id: 4,
      title: 'Send your first campaign',
      time: '2 minutes',
      summary: 'Launch your outreach and watch the results roll in.',
      body: 'Send your campaign to your extracted contacts. Track opens, clicks, and responses in real-time.',
      primaryLabel: 'Send campaign',
      primaryTo: '/app/campaigns',
      secondaryLabel: 'View results',
    },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = onboardingSteps.length;
  const stepsCompleted = onboardingSteps.filter((step) => {
    if (step.id === 1) return scansFromActivity.length > 0;
    if (step.id === 2) return recentCampaigns.length > 0;
    if (step.id === 3) return false; // TODO: check if senders exist
    if (step.id === 4) return statsFromCampaigns.sent > 0;
    return false;
  }).length;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 md:mb-6">
          <div>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-28 shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-blaster-bg-card rounded-xl border border-blaster-border p-5 shadow-sm">
              <Skeleton className="h-8 w-12 mb-2" />
              <Skeleton className="h-10 w-16 mb-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
            <ul className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="flex justify-between py-2 border-b border-blaster-border last:border-0">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <ul className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="py-2 border-b border-blaster-border last:border-0">
                  <Skeleton className="h-4 w-full" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-sm mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 px-4 py-3 md:px-6 md:py-4 border-b border-blaster-border">
          <div>
            <h1 className="text-base md:text-lg font-semibold text-blaster-fg">Dashboard</h1>
            <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Overview of your outreach campaigns</p>
          </div>
          <Link
            to="/app/scanner"
            className="inline-flex items-center gap-2 btn-blaster-accent shrink-0"
          >
            New Scan
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-blaster-border">
          {[
            { label: 'Total Campaigns', value: statsFromCampaigns.total, Icon: Send },
            { label: 'Emails Sent', value: statsFromCampaigns.sent, Icon: Check },
            { label: 'Failed Emails', value: statsFromCampaigns.failed, Icon: X },
            { label: 'Emails Extracted', value: emailsExtracted, Icon: Mail, sub: 'From scans' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-2 text-xs md:text-sm text-blaster-muted">
                <s.Icon className="w-[14px] h-[14px] md:w-[15px] md:h-[15px] shrink-0 text-blaster-fg" strokeWidth={2} />
                <span>{s.label}</span>
              </div>
              <div className="mt-3 md:mt-[23px] text-xl md:text-2xl font-semibold text-blaster-fg">{s.value}</div>
              {s.sub && <div className="mt-0.5 md:mt-1 text-[10px] md:text-xs text-blaster-muted">{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {isNewUser ? (
        <div className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-sm mb-6 md:mb-8">
          <div className="border-b border-blaster-border px-4 py-3 md:px-6 md:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 md:mb-3">
              <div>
                <h2 className="text-sm md:text-base lg:text-lg font-semibold text-blaster-fg">
                  Let&apos;s get your outreach engine running
                </h2>
                <p className="text-[11px] md:text-xs text-blaster-muted mt-0.5">
                  Follow these steps to go from zero to your first campaign.
                </p>
              </div>
              <div className="text-right text-[11px] md:text-xs text-blaster-muted">
                <span className="font-medium text-blaster-fg">
                  {stepsCompleted}/{totalSteps}
                </span>{' '}
                steps complete
              </div>
            </div>
            <div className="w-full bg-blaster-border rounded-full h-2">
              <div
                className="bg-blaster-accent h-2 rounded-full transition-all duration-500"
                style={{ width: `${(stepsCompleted / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {onboardingSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`
                    relative p-4 md:p-5 rounded-xl border transition-all
                    ${
                      index === currentStep
                        ? 'border-blaster-accent bg-blaster-accent/5'
                        : index < currentStep
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-blaster-border bg-blaster-bg'
                    }
                  `}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0
                        ${
                          index < currentStep
                            ? 'bg-green-500 text-white'
                            : index === currentStep
                            ? 'bg-blaster-accent text-white'
                            : 'bg-blaster-border text-blaster-muted'
                        }
                      `}
                    >
                      {index < currentStep ? '✓' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-blaster-fg text-sm md:text-base mb-1">{step.title}</h3>
                      <p className="text-xs md:text-sm text-blaster-muted mb-2 md:mb-3">{step.summary}</p>
                      <p className="text-xs text-blaster-muted mb-3 md:mb-4">{step.body}</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Link
                          to={step.primaryTo}
                          className="btn-blaster-accent text-xs md:text-sm"
                        >
                          {step.primaryLabel}
                        </Link>
                        {step.secondaryLabel && (
                          <button
                            type="button"
                            onClick={() => setCurrentStep(index + 1)}
                            className="text-xs md:text-sm text-blaster-muted hover:text-blaster-fg transition"
                          >
                            {step.secondaryLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-sm md:text-base font-semibold text-blaster-fg">Recent Campaigns</h2>
              <Link to="/app/campaigns" className="text-xs md:text-sm font-medium text-blaster-accent hover:underline">
                View all →
              </Link>
            </div>
            {recentCampaigns.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-blaster-muted text-sm md:text-base">
                <p>No campaigns yet</p>
                <Link to="/app/campaigns" className="inline-block mt-2 md:mt-3 btn-blaster-accent text-xs md:text-sm">
                  Create Campaign
                </Link>
              </div>
            ) : (
              <ul className="space-y-1 md:space-y-2">
                {recentCampaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-1.5 md:py-2 border-b border-blaster-border last:border-0">
                    <Link to="/app/campaigns" className="text-blaster-fg font-medium truncate text-sm md:text-base">
                      {c.sent}/{c.totalQueued} sent
                    </Link>
                    <span className="text-[10px] md:text-xs text-blaster-muted capitalize shrink-0 ml-2">
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-sm md:text-base font-semibold text-blaster-fg">Recent Activity</h2>
              <Link to="/app/activity" className="text-xs md:text-sm font-medium text-blaster-accent hover:underline">
                View all →
              </Link>
            </div>
            {scansFromActivity.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-blaster-muted text-sm md:text-base">
                <p>No recent activity</p>
                <Link to="/app/scanner" className="inline-block mt-2 md:mt-3 btn-blaster-accent text-xs md:text-sm">
                  Start Scanning
                </Link>
              </div>
            ) : (
              <ul className="space-y-1 md:space-y-2">
                {scansFromActivity.map((log) => (
                  <li key={log.id} className="flex items-center justify-between py-1.5 md:py-2 border-b border-blaster-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`
                          w-2 h-2 rounded-full shrink-0
                          ${
                            log.type === 'scan_complete'
                              ? 'bg-green-500'
                              : log.type === 'scan_start'
                              ? 'bg-blue-500'
                              : 'bg-blaster-border'
                          }
                        `}
                      />
                      <span className="text-xs md:text-sm text-blaster-muted truncate">
                        {log.type === 'scan_complete'
                          ? `Scan completed: ${log.result?.foundCount || 0} emails found`
                          : log.type === 'scan_start'
                          ? 'Scan started'
                          : log.message || 'Unknown activity'}
                      </span>
                    </div>
                    <span className="text-[10px] md:text-xs text-blaster-muted shrink-0 ml-2">
                      {formatActivityTime(log.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
