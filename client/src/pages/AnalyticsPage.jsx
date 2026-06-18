import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { DashboardMetricsPanel } from '../components/dashboard/DashboardMetricsPanel.jsx';
import { FeatureLockOverlay } from '../components/access/PlanAccessUI.jsx';

export function AnalyticsPage() {
  const { user } = useAuth();
  const { access, loading: planLoading } = usePlanAccess();
  const [range, setRange] = useState('7d');
  const { loading, metrics, streaksAndBadges, recentFeed, setDailyTarget, settingTarget } = useDashboardData(range);

  const analyticsLocked = access?.analytics ?? false;

  return (
    <div className="relative min-h-full">
      <DashboardMetricsPanel
        loading={loading || planLoading}
        metrics={metrics}
        range={range}
        onRangeChange={setRange}
        showPageHeader
        showCreateButton={false}
        showCampaigns={false}
        showActivity
        showStreaks
        streaksAndBadges={streaksAndBadges}
        recentFeed={recentFeed}
        onSetTarget={setDailyTarget}
        settingTarget={settingTarget}
        pageTitle="Analytics"
        pageSubtitle="Deep metrics across your scans, campaigns, and outreach performance"
        userName={user?.name || user?.email?.split('@')[0]}
        outerBgClass="bg-blaster-sidebar"
      />
      {analyticsLocked && (
        <FeatureLockOverlay
          message="Upgrade to view your analytics."
          className="absolute inset-0 z-10"
          minHeight="100%"
        />
      )}
    </div>
  );
}
