import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { formatTimeOfDayGreeting } from '../utils/dateUtils.js';
import {
  PerformanceStatsCard,
  DashboardOnboarding,
  DashboardActivityAchievements,
} from '../components/dashboard/DashboardSections.jsx';
import {
  DashboardHeaderSkeleton,
  PerformanceStatsCardSkeleton,
  DashboardActivityAchievementsSkeleton,
} from '../components/dashboard/DashboardSkeletons.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState('7d');
  const { loading, metrics, onboarding, streaksAndBadges, recentFeed, setDailyTarget, settingTarget } = useDashboardData(range);
  const displayName = user?.name || user?.email?.split('@')[0];

  return (
    <div className="min-h-full bg-white p-4 sm:p-6 md:p-8">
      {loading ? (
        <DashboardHeaderSkeleton />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-blaster-fg">Dashboard</h1>
            <p className="text-sm text-blaster-muted mt-1">
              {formatTimeOfDayGreeting(displayName)}
            </p>
          </div>
          <Link
            to="/app/campaigns"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition shrink-0"
          >
            <span className="text-lg leading-none">+</span>
            Create campaign
          </Link>
        </div>
      )}

      <div className="flex flex-col border border-blaster-border rounded-2xl overflow-hidden divide-y divide-blaster-border">
        {loading ? (
          <>
            <PerformanceStatsCardSkeleton embedded showRangePicker />
            <DashboardActivityAchievementsSkeleton embedded />
          </>
        ) : (
          <>
            {onboarding.showGuide && (
              <DashboardOnboarding steps={onboarding.steps} userName={displayName} embedded />
            )}

            <PerformanceStatsCard
              stats={metrics.dashboardStats}
              embedded
              range={range}
              onRangeChange={setRange}
              showRangePicker={onboarding.hasAnyActivity}
            />

            <DashboardActivityAchievements
              recentFeed={recentFeed}
              streaksAndBadges={streaksAndBadges}
              embedded
              onSetTarget={setDailyTarget}
              settingTarget={settingTarget}
            />
          </>
        )}
      </div>
    </div>
  );
}
