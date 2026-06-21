import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, TrendingUp, TrendingDown, Minus, Mail, Zap, Award, Target, Star, Edit } from 'react-feather';
import { RecentActivityList } from './RecentActivityList.jsx';
import { FeatureLockOverlay } from '../access/PlanAccessUI.jsx';
import { MIN_DAILY_TARGET } from '../../utils/streaksAndBadges.js';
import {
  PerformanceStatsCardSkeleton,
  StreaksAndBadgesPanelSkeleton,
  DashboardActivityAchievementsSkeleton,
} from './DashboardSkeletons.jsx';

const RANGE_OPTIONS = ['24h', '7d', '31d', 'All'];

function RangePills({ range, onRangeChange }) {
  return (
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
  );
}

export function TrendBadge({ trend }) {
  const { label, direction } = trend || { label: 'N/A', direction: 'neutral' };
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium shrink-0';
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

function formatDateLabel() {
  return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PerformanceStatsCard({ title = 'Performance over time', stats, loading, embedded = false, range, onRangeChange, showRangePicker = true }) {
  const shell = embedded
    ? 'bg-white overflow-hidden'
    : 'rounded-2xl border border-blaster-border bg-white overflow-hidden';

  if (loading) {
    return <PerformanceStatsCardSkeleton embedded={embedded} showRangePicker={showRangePicker} />;
  }

  return (
    <div className={shell}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-b border-blaster-border">
        <div>
          <h2 className="text-base font-semibold text-blaster-fg">{title}</h2>
          <p className="text-xs text-blaster-muted mt-0.5">{formatDateLabel()}</p>
        </div>
        {showRangePicker && <RangePills range={range} onRangeChange={onRangeChange} />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-blaster-border">
        {stats.map((item) => (
          <div key={item.key} className="px-5 sm:px-6 py-6">
            <p className="text-sm text-blaster-muted mb-3">{item.label}</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl sm:text-3xl font-semibold text-blaster-fg tracking-tight">{item.value}</p>
              <TrendBadge trend={item.trend} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardOnboarding({ steps, userName, embedded = false }) {
  const completed = steps.filter((s) => s.done).length;
  const progress = Math.round((completed / steps.length) * 100);
  const shell = embedded
    ? 'bg-white overflow-hidden'
    : 'rounded-2xl border border-blaster-border bg-white overflow-hidden';

  return (
    <div className={shell}>
      <div className="px-5 sm:px-6 py-5 border-b border-blaster-border">
        <h2 className="text-base font-semibold text-blaster-fg">
          Welcome{userName ? `, ${userName}` : ''} — let&apos;s get you started
        </h2>
        <p className="text-sm text-blaster-muted mt-1">
          Follow this quick checklist to set up your first outreach workflow.
        </p>
        <div className="mt-4 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blaster-accent to-blaster-orange"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-blaster-muted mt-2">{completed} of {steps.length} completed</p>
      </div>
      <ul className="divide-y divide-blaster-border">
        {steps.map((step, index) => (
          <li key={step.id} className="px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  step.done
                    ? 'bg-gradient-to-br from-blaster-accent to-blaster-orange border-transparent text-white'
                    : 'border-blaster-border text-blaster-muted'
                }`}
              >
                {step.done ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-medium">{index + 1}</span>}
              </span>
              <div>
                <p className={`text-sm font-medium ${step.done ? 'text-blaster-muted line-through' : 'text-blaster-fg'}`}>
                  {step.label}
                </p>
              </div>
            </div>
            {!step.done && (
              <Link
                to={step.to}
                className="shrink-0 inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-medium text-black bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 border border-blaster-accent/25 hover:from-blaster-accent/28 hover:to-blaster-orange/38 transition shadow-sm"
              >
                Start
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BadgeIcon({ name, unlocked, type }) {
  const iconColor =
    unlocked && type === 'streak'
      ? 'text-blaster-orange'
      : unlocked
        ? 'text-blaster-accent'
        : 'text-gray-300';
  const cls = `w-5 h-5 ${iconColor}`;
  switch (name) {
    case 'fire':
      return (
        <span
          className={`text-lg leading-none ${unlocked ? 'drop-shadow-sm' : 'grayscale opacity-40'}`}
          aria-hidden
        >
          🔥
        </span>
      );
    case 'zap':
      return <Zap className={cls} strokeWidth={1.75} />;
    case 'wallet':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case 'trophy':
      return <Award className={cls} strokeWidth={1.75} />;
    case 'target':
      return <Target className={cls} strokeWidth={1.75} />;
    case 'medal':
      return <Award className={cls} strokeWidth={1.75} />;
    case 'rocket':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'star':
      return <Star className={cls} strokeWidth={1.75} />;
    case 'crown':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 16l-1-9 5 4 3-6 3 6 5-4-1 9H5z" />
        </svg>
      );
    case 'ribbon':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    default:
      return <Award className={cls} strokeWidth={1.75} />;
  }
}

function badgeTileClass(badge) {
  if (!badge.unlocked) return 'bg-gray-50 border-blaster-border/60';
  if (badge.type === 'streak') {
    return 'bg-gradient-to-br from-blaster-orange/35 to-orange-50 border-blaster-orange/50';
  }
  return 'bg-gradient-to-br from-blaster-accent/25 to-indigo-50 border-blaster-accent/45';
}

function badgeLabelClass(badge) {
  if (!badge.unlocked) return 'text-gray-400';
  if (badge.type === 'streak') return 'text-orange-800 font-semibold';
  return 'text-blaster-accent font-semibold';
}

function BrandGradientIcon({ Icon, className = 'w-4 h-4' }) {
  const id = React.useId().replace(/:/g, '');
  const gradientId = `brand-gradient-${id}`;

  return (
    <span className="inline-flex shrink-0">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#fcb04c" />
          </linearGradient>
        </defs>
      </svg>
      <Icon className={className} stroke={`url(#${gradientId})`} strokeWidth={1.75} />
    </span>
  );
}

const STREAK_TARGET_EDIT_UNLOCK = 30;

function DailyTargetForm({
  targetInput,
  setTargetInput,
  canSetTarget,
  settingTarget,
  onSave,
  onCancel,
  saveLabel = 'Set',
}) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-blaster-border bg-gray-50/80 p-3 space-y-3 animate-[fadeIn_0.2s_ease-out]">
      <label className="block text-xs font-medium text-blaster-muted">
        Daily emails to send (min {MIN_DAILY_TARGET})
      </label>
      <input
        type="number"
        min={MIN_DAILY_TARGET}
        step={1}
        value={targetInput}
        onChange={(e) => setTargetInput(e.target.value)}
        placeholder={`e.g. ${MIN_DAILY_TARGET}`}
        className="w-full px-3 py-2 rounded-lg border border-blaster-border bg-white text-sm text-blaster-fg focus:outline-none focus:ring-2 focus:ring-blaster-accent/30"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-blaster-border text-blaster-muted hover:text-blaster-fg transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSetTarget || settingTarget}
          className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition ${
            canSetTarget
              ? 'bg-black border-blaster-orange text-[#faf8f5] shadow-blaster-cta hover:opacity-90'
              : 'bg-gray-100 text-gray-400 border-blaster-border cursor-not-allowed'
          }`}
        >
          {settingTarget ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}

function StreakStatValue({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium shrink-0 bg-gray-100 text-blaster-muted">
      {children}
    </span>
  );
}

export function StreaksAndBadgesPanel({
  streaksAndBadges,
  loading,
  fullWidth = false,
  onSetTarget,
  settingTarget = false,
}) {
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  if (loading) {
    return <StreaksAndBadgesPanelSkeleton fullWidth={fullWidth} />;
  }

  const data = streaksAndBadges || {
    streakLabel: 'Set your daily target',
    currentStreak: 0,
    hasDailyTarget: false,
    dailyTarget: null,
    emailsSentToday: 0,
    thisWeekEmails: 0,
    allTimeEmails: 0,
    badges: [],
  };

  const parsedTarget = Number(targetInput);
  const canSetTarget = Number.isFinite(parsedTarget) && parsedTarget >= MIN_DAILY_TARGET;
  const dailyTarget = data.dailyTarget || 0;
  const emailsSentTodayDisplay = dailyTarget
    ? Math.min(data.emailsSentToday || 0, dailyTarget)
    : data.emailsSentToday || 0;
  const canEditTarget =
    data.hasDailyTarget &&
    ((data.currentStreak || 0) >= STREAK_TARGET_EDIT_UNLOCK ||
      (data.highestStreakBadgeEarned || 0) >= STREAK_TARGET_EDIT_UNLOCK);

  const handleSetTarget = async () => {
    if (!canSetTarget || !onSetTarget) return;
    const result = await onSetTarget(parsedTarget);
    if (result?.ok) {
      setTargetOpen(false);
      setTargetInput('');
    }
  };

  const openTargetEditor = () => {
    setTargetInput(data.dailyTarget ? String(data.dailyTarget) : '');
    setTargetOpen(true);
  };

  const closeTargetEditor = () => {
    setTargetOpen(false);
    setTargetInput('');
  };

  return (
    <div className="px-5 sm:px-6 py-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg leading-none">🔥</span>
        <h2 className="text-base font-semibold text-blaster-fg">Streaks &amp; Badges</h2>
      </div>

      <div className="flex flex-col items-end mb-5">
        {!data.hasDailyTarget ? (
          !targetOpen ? (
              <button
                type="button"
                onClick={() => setTargetOpen(true)}
                className="w-[136px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-[rgba(227,227,237,0.25)] bg-gradient-to-r from-[rgba(99,102,241,0.2)] to-[rgba(252,176,76,0.3)] text-black hover:from-[rgba(99,102,241,0.28)] hover:to-[rgba(252,176,76,0.38)] transition shadow-sm"
              >
                Set target
              </button>
            ) : (
              <DailyTargetForm
                targetInput={targetInput}
                setTargetInput={setTargetInput}
                canSetTarget={canSetTarget}
                settingTarget={settingTarget}
                onSave={handleSetTarget}
                onCancel={closeTargetEditor}
              />
            )
        ) : targetOpen && canEditTarget ? (
          <DailyTargetForm
            targetInput={targetInput}
            setTargetInput={setTargetInput}
            canSetTarget={canSetTarget}
            settingTarget={settingTarget}
            onSave={handleSetTarget}
            onCancel={closeTargetEditor}
            saveLabel="Save"
          />
        ) : (
          <div className="inline-flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border ${
                (data.currentStreak || 0) > 0
                  ? 'bg-gradient-to-r from-blaster-orange/35 to-orange-50 border-blaster-orange/50 text-orange-800'
                  : 'bg-orange-50 border-orange-100 text-blaster-fg'
              }`}
            >
              <span aria-hidden>🔥</span>
              {data.streakLabel}
            </span>
            {canEditTarget ? (
              <button
                type="button"
                onClick={openTargetEditor}
                className="p-2 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition"
                aria-label="Edit daily target"
                title="Edit daily target"
              >
                <Edit className="w-4 h-4" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {data.hasDailyTarget && (
        <p className="text-right text-xs text-blaster-muted -mt-3 mb-5">
          {emailsSentTodayDisplay.toLocaleString()} / {dailyTarget.toLocaleString()} sent today
        </p>
      )}

      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-blaster-border/60">
          <div className="flex items-center gap-2.5 text-sm text-blaster-muted">
            <BrandGradientIcon Icon={Mail} />
            All time
          </div>
          <StreakStatValue>{data.allTimeEmails.toLocaleString()}</StreakStatValue>
        </div>
      </div>

      <p className="text-sm font-medium text-blaster-muted mb-3">Achievements</p>
      <div className={`grid gap-2 sm:gap-3 ${fullWidth ? 'grid-cols-3 sm:grid-cols-10' : 'grid-cols-3 sm:grid-cols-5'}`}>
        {data.badges.map((badge) => (
          <div
            key={badge.id}
            className={`flex flex-col items-center justify-center gap-2 p-2 sm:p-3 rounded-xl border aspect-square text-center transition ${badgeTileClass(badge)}`}
            title={badge.label}
          >
            <BadgeIcon name={badge.icon} unlocked={badge.unlocked} type={badge.type} />
            <span className={`text-[10px] sm:text-xs leading-tight font-medium ${badgeLabelClass(badge)}`}>
              {badge.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardActivityAchievements({
  recentFeed,
  streaksAndBadges,
  loading,
  embedded = false,
  onSetTarget,
  settingTarget,
  streakLocked = false,
}) {
  if (loading) {
    return <DashboardActivityAchievementsSkeleton embedded={embedded} />;
  }

  const shell = embedded
    ? 'bg-white overflow-hidden'
    : 'rounded-2xl border border-blaster-border bg-white overflow-hidden';

  return (
    <div className={shell}>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-blaster-border">
        <div className="relative">
          <StreaksAndBadgesPanel
            streaksAndBadges={streaksAndBadges}
            fullWidth={false}
            onSetTarget={onSetTarget}
            settingTarget={settingTarget}
          />
          {streakLocked && (
            <FeatureLockOverlay
              message="Upgrade to set and track your streak."
              className="absolute inset-0 z-10"
              minHeight="100%"
            />
          )}
        </div>

        <div>
          <div className="px-5 sm:px-6 py-4 border-b border-blaster-border">
            <h2 className="text-base font-semibold text-blaster-fg">Recent activity</h2>
            <p className="text-xs text-blaster-muted mt-0.5">Latest scans and actions</p>
          </div>
          <RecentActivityList items={recentFeed} />
        </div>
      </div>
    </div>
  );
}
