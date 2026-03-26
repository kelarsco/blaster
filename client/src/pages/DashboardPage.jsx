import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Check, X, Mail } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

const SKELETON_DURATION_MS = 1500;

function UpgradeBanner() {
  return (
    <div className="bg-blaster-accent/10 border border-blaster-accent/20 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blaster-accent/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blaster-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-blaster-fg">Upgrade to Use Scanner</h3>
            <p className="text-sm text-blaster-muted">Choose a plan to start extracting emails and sending campaigns</p>
          </div>
        </div>
        <Link 
          to="/app/account/pricing" 
          className="bg-blaster-accent hover:bg-blaster-accent/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Choose Plan
        </Link>
      </div>
    </div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-blaster-border/60 ${className}`} />;
}

export function DashboardPage() {
  const { authFetch, subscription, user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [emailsExtracted, setEmailsExtracted] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState('this_year');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [pendingRange, setPendingRange] = useState({ start: '', end: '' });
   const [activeStep, setActiveStep] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // HARDCODED BYPASS - Manual admin upgrades (temporary fix)
  const MANUALLY_UPGRADED_USERS = [
    'dkelaroma@gmail.com', // Add other manually upgraded users here
  ];

  // Ultimate bypass - check if user is in manually upgraded list
  const shouldShowUpgradeBanner = () => {
    // HARDCODED CHECK: If user email is in manually upgraded list, NO upgrade banner
    if (user && MANUALLY_UPGRADED_USERS.includes(user.email)) {
      console.log('BYPASS: User is in manually upgraded list:', user.email);
      return false;
    }
    
    // FIRST PRIORITY: Check user object directly (most reliable for admin upgrades)
    if (user) {
      // If user has admin or premium role, NO upgrade banner
      if (user.role === 'admin' || user.role === 'premium') return false;
      
      // If user has planId that's not free, NO upgrade banner
      if (user.planId && user.planId !== 'free') return false;
      
      // If user has any plan property that indicates paid status
      if (user.plan && user.plan !== 'free') return false;
    }
    
    // SECOND PRIORITY: Check subscription object (for Paystack users)
    if (subscription) {
      // If admin manually upgraded flag is set, NO upgrade banner
      if (subscription.adminUpgraded) return false;
      
      // If subscription has any planId that's not free, NO upgrade banner
      if (subscription.planId && subscription.planId !== 'free') return false;
      
      // If explicitly free plan, show upgrade banner
      if (subscription.planId === 'free') return true;
    }
    
    // FALLBACK: If no data, show upgrade banner
    return true;
  };

  // Debug logging (remove in production)
  console.log('DashboardPage Debug - HARDCODED BYPASS:', {
    userEmail: user?.email,
    isInManualList: user && MANUALLY_UPGRADED_USERS.includes(user.email),
    manuallyUpgradedUsers: MANUALLY_UPGRADED_USERS,
    user: user ? { 
      id: user.id, 
      role: user.role, 
      planId: user.planId,
      plan: user.plan,
      email: user.email 
    } : null,
    subscription: subscription ? { 
      status: subscription.status, 
      planId: subscription.planId, 
      adminUpgraded: subscription.adminUpgraded 
    } : null,
    shouldShowUpgradeBanner: shouldShowUpgradeBanner(),
    userRole: user?.role,
    userPlanId: user?.planId,
    userPlan: user?.plan
  });

  const startDate = pendingRange.start ? new Date(pendingRange.start) : null;
  const endDate = pendingRange.end ? new Date(pendingRange.end) : null;

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const toLocalDateString = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getCalendarDays = () => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const firstWeekday = (start.getDay() + 6) % 7; // Monday as first day
    const daysInCurrent = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();

    const days = [];

    // Days from previous month to fill first week
    for (let i = 0; i < firstWeekday; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() - (firstWeekday - i));
      days.push({ date: d, inCurrentMonth: false });
    }

    // Days in current month
    for (let i = 1; i <= daysInCurrent; i += 1) {
      const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i);
      days.push({ date: d, inCurrentMonth: true });
    }

    // Days from next month to complete grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i += 1) {
      const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, i);
      days.push({ date: d, inCurrentMonth: false });
    }

    return days;
  };

  const calendarDays = getCalendarDays();

  const handleDayClick = (day) => {
    const iso = toLocalDateString(day);

    if (!startDate || (startDate && endDate)) {
      setPendingRange({ start: iso, end: '' });
      return;
    }

    const clicked = day.getTime();
    const startTime = startDate.getTime();

    if (clicked < startTime) {
      setPendingRange({ start: iso, end: pendingRange.start });
    } else if (clicked === startTime) {
      setPendingRange({ start: iso, end: '' });
    } else {
      setPendingRange({ start: pendingRange.start, end: iso });
    }
  };

  const changeMonth = (offset) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
  };

  const calendarTitle = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(calendarMonth);

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
        .replace(' ', '');
      return `${day}/${time}`;
    } catch {
      return '';
    }
  };

  const formatRangeLabel = () => {
    if (rangePreset === 'custom' && dateRange.start && dateRange.end) {
      const opts = { year: 'numeric', month: 'short', day: 'numeric' };
      return `${new Date(dateRange.start).toLocaleDateString(undefined, opts)} \u2013 ${new Date(
        dateRange.end,
      ).toLocaleDateString(undefined, opts)}`;
    }
    switch (rangePreset) {
      case 'this_year':
        return 'This year';
      case 'today':
        return 'Today';
      case 'last_7_days':
        return 'Last 7 days';
      case 'last_30_days':
        return 'Last 30 days';
      case 'all_time':
        return 'All time';
      default:
        return 'Custom range';
    }
  };

  const applyPresetRange = React.useCallback((preset) => {
    const today = new Date();
    let start = '';
    let end = '';

    if (preset === 'today') {
      start = end = today.toISOString().slice(0, 10);
    } else if (preset === 'last_7_days') {
      const endDate = today;
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 6);
      start = startDate.toISOString().slice(0, 10);
      end = endDate.toISOString().slice(0, 10);
    } else if (preset === 'last_30_days') {
      const endDate = today;
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 29);
      start = startDate.toISOString().slice(0, 10);
      end = endDate.toISOString().slice(0, 10);
    } else if (preset === 'this_year') {
      const startDate = new Date(today.getFullYear(), 0, 1);
      const endDate = today;
      start = startDate.toISOString().slice(0, 10);
      end = endDate.toISOString().slice(0, 10);
    } else {
      start = '';
      end = '';
    }

    setDateRange({ start, end });
  }, []);

  const getEffectiveRange = React.useCallback(() => {
    if (rangePreset === 'all_time') return null;
    if (rangePreset === 'custom') {
      if (dateRange.start && dateRange.end) return { start: dateRange.start, end: dateRange.end };
      return null;
    }
    const today = new Date();
    let start = '';
    let end = '';
    if (rangePreset === 'today') {
      start = end = today.toISOString().slice(0, 10);
    } else if (rangePreset === 'last_7_days') {
      const startDate = new Date();
      startDate.setDate(today.getDate() - 6);
      start = startDate.toISOString().slice(0, 10);
      end = today.toISOString().slice(0, 10);
    } else if (rangePreset === 'last_30_days') {
      const startDate = new Date();
      startDate.setDate(today.getDate() - 29);
      start = startDate.toISOString().slice(0, 10);
      end = today.toISOString().slice(0, 10);
    } else if (rangePreset === 'this_year') {
      start = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
      end = today.toISOString().slice(0, 10);
    }
    return start && end ? { start, end } : null;
  }, [rangePreset, dateRange.start, dateRange.end]);

  const isDateInRange = (isoString, range) => {
    if (!range || !isoString) return true;
    const d = new Date(isoString);
    const day = toLocalDateString(d);
    return day >= range.start && day <= range.end;
  };

  const fetchDashboardData = React.useCallback(() => {
    if (!authFetch) return;
    Promise.all([
      authFetch(`${API}/campaigns`)
        .then((r) => (r.ok ? r.json() : { campaigns: [] }))
        .then((d) => {
          const list = d.campaigns || [];
          setCampaigns(list);
          setStats({
            total: list.length,
            sent: list.reduce((s, c) => s + (c.sent || 0), 0),
            failed: list.reduce((s, c) => s + (c.failed || 0), 0),
          });
        }),
      authFetch(`${API}/activity/logs?limit=20`)
        .then((r) => (r.ok ? r.json() : { logs: [] }))
        .then((d) => setActivity(d.logs || [])),
      authFetch(`${API}/scan/analytics`)
        .then((r) => (r.ok ? r.json() : { extracted: 0 }))
        .then((d) => setEmailsExtracted(Number(d.extracted || 0))),
    ]);
  }, [authFetch]);

  useEffect(() => {
    const minDelay = new Promise((r) => setTimeout(r, SKELETON_DURATION_MS));
    const dataPromise = fetchDashboardData();
    Promise.all([minDelay, dataPromise]).then(() => setLoading(false));
  }, [fetchDashboardData]);

  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 4000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  useEffect(() => {
    applyPresetRange(rangePreset);
  }, []);

  const effectiveRange = getEffectiveRange();
  const filteredCampaigns = effectiveRange
    ? campaigns.filter((c) => isDateInRange(c.createdAt, effectiveRange))
    : campaigns;
  const filteredActivity = effectiveRange
    ? activity.filter((log) => isDateInRange(log.createdAt, effectiveRange))
    : activity;

  const statsFromFiltered = {
    total: filteredCampaigns.length,
    sent: filteredCampaigns.reduce((s, c) => s + (c.sent || 0), 0),
    failed: filteredCampaigns.reduce((s, c) => s + (c.failed || 0), 0),
  };

  const recentCampaigns = filteredCampaigns.slice(0, 5);
  const scansFromActivity = filteredActivity
    .filter((l) => l.type === 'scan_complete' || l.type === 'scan_start')
    .slice(0, 5);
  const isNewUser = recentCampaigns.length === 0 && scansFromActivity.length === 0;

  const onboardingSteps = [
    {
      id: 1,
      title: 'Add your first site',
      time: '2 minutes',
      summary: 'Tell us what to scout so we can start finding leads.',
      body: 'Connect a store or any website you want Store Scouter to analyze. We will crawl pages, extract contacts, and prepare everything for your first campaign.',
      primaryLabel: 'Add a site to scan',
      primaryTo: '/app/scanner',
      secondaryLabel: 'Skip for now',
    },
    {
      id: 2,
      title: 'Run your first scan',
      time: '3 minutes',
      summary: 'Kick off a scan to collect real contacts.',
      body: 'Choose a site and start a scan. We will automatically discover email addresses and activity you can turn into outreach.',
      primaryLabel: 'Start a new scan',
      primaryTo: '/app/scanner',
      secondaryLabel: 'View scanner activity',
    },
    {
      id: 3,
      title: 'Draft your first campaign',
      time: '5 minutes',
      summary: 'Turn contacts into a simple, focused campaign.',
      body: 'Use presets or start from scratch to create a campaign. Add your subject line and message once, then reuse it across scans.',
      primaryLabel: 'Create campaign',
      primaryTo: '/app/campaigns',
      secondaryLabel: 'Browse campaigns',
    },
    {
      id: 4,
      title: 'Connect your sending inbox',
      time: '4 minutes',
      summary: 'Connect an email sender so we can send on your behalf.',
      body: 'Hook up a real sending address so Store Scouter can send campaigns for you safely and track results over time.',
      primaryLabel: 'Connect sender',
      primaryTo: '/app/senders',
      secondaryLabel: 'Configure later',
    },
  ];

  const totalSteps = onboardingSteps.length;
  const stepsCompleted = 0;
  const activeOnboardingStep =
    onboardingSteps.find((s) => s.id === activeStep) ?? onboardingSteps[0];

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-28 shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-blaster-bg-card rounded-xl border border-blaster-border p-5 shadow-sm">
              <Skeleton className="h-8 w-12 mb-2" />
              <Skeleton className="h-4 w-24" />
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
      {/* Show upgrade banner only for free users */}
      {shouldShowUpgradeBanner() && <UpgradeBanner />}
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3 mb-3 md:mb-4">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm text-blaster-muted">
          <span className="font-medium text-blaster-fg">Show:</span>
          <select
            value={rangePreset}
            onChange={(e) => {
              const preset = e.target.value;
              setRangePreset(preset);
              applyPresetRange(preset);
            }}
            className="mx-[2px] bg-blaster-bg border border-blaster-border rounded-xl pl-[17px] pr-8 py-2 text-sm text-blaster-fg shadow-sm hover:bg-blaster-bg-app transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blaster-accent/30"
          >
            <option value="this_year">This year</option>
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="all_time">All time</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => {
              const base = dateRange.start ? new Date(dateRange.start) : new Date();
              setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
              setPendingRange(dateRange);
              setIsDatePickerOpen((open) => !open);
            }}
            className="inline-flex items-center justify-between gap-2 rounded-xl border border-blaster-border bg-blaster-bg px-3 py-2 text-sm text-blaster-fg shadow-sm hover:bg-blaster-bg-app transition"
          >
            <span className="text-blaster-muted">Custom range</span>
            <span className="font-medium">{formatRangeLabel()}</span>
          </button>

          {isDatePickerOpen && (
            <div className="absolute right-0 mt-2 z-40">
              <div className="bg-gradient-to-b from-white via-blaster-bg-app to-blaster-bg rounded-3xl border border-blaster-border shadow-glass p-4 sm:p-5 w-80 sm:w-96">
                <div className="flex items-center justify-between mb-3 text-sm text-blaster-fg">
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blaster-bg-app text-blaster-muted"
                    onClick={() => changeMonth(-1)}
                  >
                    ‹
                  </button>
                  <p className="font-semibold">{calendarTitle}</p>
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blaster-bg-app text-blaster-muted"
                    onClick={() => changeMonth(1)}
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 mb-2 text-xs text-blaster-muted">
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                    <div key={d} className="flex items-center justify-center h-6">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-sm">
                  {calendarDays.map(({ date, inCurrentMonth }) => {
                    const isStart = startDate && sameDay(date, startDate);
                    const isEnd = endDate && sameDay(date, endDate);
                    const inRange =
                      startDate &&
                      endDate &&
                      date >= startDate &&
                      date <= endDate;
                    const isSelected = isStart || isEnd;

                    let cellClasses =
                      'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl cursor-pointer transition text-xs sm:text-sm ';

                    if (!inCurrentMonth) {
                      cellClasses += 'text-blaster-muted/40 ';
                    } else {
                      cellClasses += 'text-blaster-fg ';
                    }

                    if (inRange && !isSelected) {
                      cellClasses += 'bg-blaster-accent/10 ';
                    }

                    if (isSelected) {
                      cellClasses += 'bg-[#1a1a21] text-white shadow-sm ';
                    } else {
                      cellClasses += 'hover:bg-blaster-bg-app ';
                    }

                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => handleDayClick(date)}
                        className={cellClasses}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-end gap-3 text-sm">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl text-blaster-muted hover:bg-blaster-bg transition"
                    onClick={() => setIsDatePickerOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-blaster-accent text-sm"
                    onClick={() => {
                      if (pendingRange.start && pendingRange.end) {
                        setDateRange(pendingRange);
                        setRangePreset('custom');
                      }
                      setIsDatePickerOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
            { label: 'Total Campaigns', value: statsFromFiltered.total, Icon: Send },
            { label: 'Emails Sent', value: statsFromFiltered.sent, Icon: Check },
            { label: 'Failed Emails', value: statsFromFiltered.failed, Icon: X },
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
            <div className="h-1.5 rounded-full bg-blaster-border overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-blaster-accent transition-all"
                style={{ width: `${(stepsCompleted / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 md:gap-6 px-4 py-4 md:px-6 md:py-6">
            <div className="flex-1 space-y-1.5 md:space-y-2">
              {onboardingSteps.map((step) => {
                const isActive = step.id === activeOnboardingStep.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={`w-full flex items-center justify-between rounded-lg md:rounded-xl px-3 py-2.5 md:px-4 md:py-3 text-left text-xs md:text-sm transition ${
                      isActive
                        ? 'bg-blaster-bg-app border border-blaster-border'
                        : 'bg-transparent border border-transparent hover:bg-blaster-bg-app/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 md:w-6 md:h-6 rounded-full border flex items-center justify-center text-[10px] md:text-xs shrink-0 ${
                          isActive ? 'bg-blaster-accent text-white border-blaster-accent' : 'border-blaster-border text-blaster-muted'
                        }`}
                      >
                        {step.id}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-blaster-fg truncate">{step.title}</div>
                        <div className="text-[10px] md:text-xs text-blaster-muted truncate">{step.summary}</div>
                      </div>
                    </div>
                    <span className="ml-2 md:ml-4 shrink-0 inline-flex items-center rounded-full bg-blaster-bg-app px-1.5 py-0.5 text-[10px] md:text-[11px] text-blaster-muted">
                      {step.time}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 lg:max-w-md">
              <div className="bg-blaster-bg-app rounded-xl md:rounded-2xl border border-blaster-border/60 p-4 md:p-5 h-full flex flex-col justify-between shadow-glass">
                <div>
                  <h3 className="text-sm md:text-base font-semibold text-blaster-fg">
                    {activeOnboardingStep.title}
                  </h3>
                  <p className="mt-1.5 md:mt-2 text-xs md:text-sm text-blaster-muted">
                    {activeOnboardingStep.body}
                  </p>
                </div>

                <div className="mt-3 md:mt-4 flex items-center justify-between gap-2 md:gap-3">
                  <div className="hidden sm:grid grid-cols-3 gap-1.5 md:gap-2 opacity-80">
                    <div className="h-10 rounded-xl bg-white border border-blaster-border shadow-sm" />
                    <div className="h-10 rounded-xl bg-white border border-blaster-border shadow-sm" />
                    <div className="h-10 rounded-xl bg-white border border-blaster-border shadow-sm" />
                    <div className="h-10 rounded-xl bg-white border border-blaster-border shadow-sm" />
                    <div className="h-10 rounded-xl bg-white border border-blaster-border shadow-sm" />
                    <div className="h-10 rounded-xl bg-white border border-blaster-border shadow-sm" />
                  </div>

                  <div className="ml-auto flex flex-col sm:flex-row gap-1.5 md:gap-2 sm:items-center">
                    <button
                      type="button"
                      className="text-[11px] md:text-xs text-blaster-muted hover:underline text-left"
                    >
                      {activeOnboardingStep.secondaryLabel}
                    </button>
                    <Link
                      to={activeOnboardingStep.primaryTo}
                      className="btn-blaster-accent text-xs md:text-sm whitespace-nowrap"
                    >
                      {activeOnboardingStep.primaryLabel}
                    </Link>
                  </div>
                </div>
              </div>
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
                      {c.status === 'running' && c.sent >= (c.totalQueued || 0) ? 'completed' : c.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-sm md:text-base font-semibold text-blaster-fg">Recent Scans</h2>
              <Link to="/app/scanner" className="text-xs md:text-sm font-medium text-blaster-accent hover:underline">
                View all →
              </Link>
            </div>
            {scansFromActivity.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-blaster-muted text-sm md:text-base">
                <div className="text-3xl md:text-4xl mb-2 opacity-50">🔍</div>
                <p>No scans yet</p>
                <Link to="/app/scanner" className="inline-block mt-2 md:mt-3 btn-blaster-accent text-xs md:text-sm">
                  Start Scanning
                </Link>
              </div>
            ) : (
              <ul className="space-y-1 md:space-y-2">
                {scansFromActivity.map((log, i) => (
                  <li key={log.id || i} className="py-1.5 md:py-2 border-b border-blaster-border last:border-0 text-xs md:text-sm text-blaster-muted">
                    {log.type === 'scan_complete' ? 'Scan completed' : 'Scan started'} —{' '}
                    {log.payload?.scanId ? String(log.payload.scanId).slice(0, 8) : '—'}
                    {log.createdAt && (
                      <span className="ml-2 text-xs text-blaster-muted/80">
                        {formatActivityTime(log.createdAt)}
                      </span>
                    )}
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
