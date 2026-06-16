import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { DashboardMetricsPanel } from '../components/dashboard/DashboardMetricsPanel.jsx';

export function AnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState('7d');
  const { loading, metrics, streaksAndBadges, recentFeed, setDailyTarget, settingTarget } = useDashboardData(range);

  return (
    <DashboardMetricsPanel
      loading={loading}
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
  );
}
