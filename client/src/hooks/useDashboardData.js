import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../api.js';
import { defaultStreaksState } from '../utils/streaksAndBadges.js';
import { buildRecentActivityFeed } from '../utils/activityFeed.js';
import { readPageCache, writePageCache } from '../utils/pageCache.js';

const CACHE_KEY = 'dashboard';
const MAX_SKELETON_MS = 3000;

const RANGE_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '31d': 31 * 24 * 60 * 60 * 1000,
  All: null,
};

function parseTime(iso) {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function inRange(iso, rangeKey, now = Date.now()) {
  const t = parseTime(iso);
  if (!Number.isFinite(t)) return false;
  const ms = RANGE_MS[rangeKey];
  if (ms == null) return true;
  return now - t <= ms;
}

function previousRange(iso, rangeKey, now = Date.now()) {
  const t = parseTime(iso);
  if (!Number.isFinite(t) || rangeKey === 'All') return false;
  const ms = RANGE_MS[rangeKey];
  return t <= now - ms && t > now - ms * 2;
}

function filterByRange(items, rangeKey, now, dateKey = 'createdAt') {
  return items.filter((item) => inRange(item[dateKey], rangeKey, now));
}

function filterByPreviousRange(items, rangeKey, now, dateKey = 'createdAt') {
  return items.filter((item) => previousRange(item[dateKey], rangeKey, now));
}

function sumScanProcessed(scanList) {
  return scanList.reduce((sum, scan) => sum + (Number(scan.processed) || 0), 0);
}

function sumScanFound(scanList) {
  return scanList.reduce((sum, scan) => sum + (Number(scan.foundCount) || 0), 0);
}

function countActiveManualRuns(runList) {
  return runList.filter((r) => r.status === 'in_progress' || r.status === 'paused').length;
}

function filterSendEventsBySentRange(events, rangeKey, now) {
  return events.filter((e) => inRange(e.sentAt, rangeKey, now));
}

function filterSendEventsBySentPreviousRange(events, rangeKey, now) {
  return events.filter((e) => previousRange(e.sentAt, rangeKey, now));
}

function trendDelta(current, previous) {
  if (previous === 0 && current === 0) return { label: 'N/A', direction: 'neutral' };
  if (previous === 0) return { label: `+${current}`, direction: 'up' };
  const diff = current - previous;
  if (diff === 0) return { label: '0', direction: 'neutral' };
  return {
    label: diff > 0 ? `+${diff}` : `${diff}`,
    direction: diff > 0 ? 'up' : 'down',
  };
}

function countEmailTemplates(presetList) {
  return presetList.reduce(
    (sum, preset) => sum + (Array.isArray(preset.templates) ? preset.templates.length : 0),
    0
  );
}

function emptyDashboardPayload() {
  return {
    campaigns: [],
    emailLists: [],
    manualRuns: [],
    sendEvents: [],
    activityLogs: [],
    scans: [],
    presets: [],
    extractedTotal: 0,
    streaksAndBadges: defaultStreaksState(),
  };
}

function applyDashboardPayload(payload, setters) {
  const p = payload || emptyDashboardPayload();
  setters.setCampaigns(p.campaigns || []);
  setters.setEmailLists(p.emailLists || []);
  setters.setManualRuns(p.manualRuns || []);
  setters.setSendEvents(p.sendEvents || []);
  setters.setActivityLogs(p.activityLogs || []);
  setters.setScans(p.scans || []);
  setters.setPresets(p.presets || []);
  setters.setExtractedTotal(Number(p.extractedTotal || 0));
  setters.setStreaksAndBadges(p.streaksAndBadges || defaultStreaksState());
}

export function useDashboardData(range = '7d') {
  const { user, authFetch } = useAuth();
  const userId = user?.id;
  const cached = userId ? readPageCache(userId, CACHE_KEY) : null;
  const hadCacheRef = useRef(Boolean(cached));

  const [campaigns, setCampaigns] = useState(cached?.campaigns ?? []);
  const [emailLists, setEmailLists] = useState(cached?.emailLists ?? []);
  const [manualRuns, setManualRuns] = useState(cached?.manualRuns ?? []);
  const [sendEvents, setSendEvents] = useState(cached?.sendEvents ?? []);
  const [activityLogs, setActivityLogs] = useState(cached?.activityLogs ?? []);
  const [scans, setScans] = useState(cached?.scans ?? []);
  const [presets, setPresets] = useState(cached?.presets ?? []);
  const [extractedTotal, setExtractedTotal] = useState(cached?.extractedTotal ?? 0);
  const [streaksAndBadges, setStreaksAndBadges] = useState(cached?.streaksAndBadges ?? defaultStreaksState());
  const [settingTarget, setSettingTarget] = useState(false);
  const [loading, setLoading] = useState(!cached);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!user || !authFetch) return;
    const hadCache = hadCacheRef.current;

    if (hadCache) setIsRevalidating(true);
    else setLoading(true);

    try {
      const [campaignsRes, dashboardMetricsRes, activityRes, scansRes, analyticsRes, presetsRes, streaksRes] =
        await Promise.all([
          authFetch(`${API}/campaigns`),
          authFetch(`${API}/campaigns/dashboard-metrics`),
          authFetch(`${API}/activity/logs?limit=200`),
          authFetch(`${API}/scan/recent`),
          authFetch(`${API}/scan/analytics`),
          authFetch(`${API}/automation/presets`),
          authFetch(`${API}/streaks`),
        ]);

      const payload = emptyDashboardPayload();

      if (campaignsRes?.ok) {
        const data = await campaignsRes.json();
        payload.campaigns = data.campaigns || [];
      }
      if (activityRes?.ok) {
        const data = await activityRes.json();
        payload.activityLogs = data.logs || [];
      }
      if (scansRes?.ok) {
        const data = await scansRes.json();
        payload.scans = Array.isArray(data) ? data : [];
      }
      if (analyticsRes?.ok) {
        const data = await analyticsRes.json();
        payload.extractedTotal = Number(data.extracted || 0);
      }
      if (presetsRes?.ok) {
        const data = await presetsRes.json();
        payload.presets = data.presets || [];
      }
      if (dashboardMetricsRes?.ok) {
        const data = await dashboardMetricsRes.json();
        payload.emailLists = Array.isArray(data?.emailLists) ? data.emailLists : [];
        payload.manualRuns = Array.isArray(data?.manualRuns) ? data.manualRuns : [];
        payload.sendEvents = Array.isArray(data?.sendEvents) ? data.sendEvents : [];
      }
      if (streaksRes?.ok) {
        payload.streaksAndBadges = await streaksRes.json();
      }

      applyDashboardPayload(payload, {
        setCampaigns,
        setEmailLists,
        setManualRuns,
        setSendEvents,
        setActivityLogs,
        setScans,
        setPresets,
        setExtractedTotal,
        setStreaksAndBadges,
      });

      if (userId) writePageCache(userId, CACHE_KEY, payload);
      hadCacheRef.current = true;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (!hadCacheRef.current) {
        applyDashboardPayload(emptyDashboardPayload(), {
          setCampaigns,
          setEmailLists,
          setManualRuns,
          setSendEvents,
          setActivityLogs,
          setScans,
          setSenders,
          setPresets,
          setExtractedTotal,
          setStreaksAndBadges,
        });
      }
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  }, [user, userId, authFetch]);

  const refreshStreaks = useCallback(async () => {
    if (!user || !authFetch) return;
    try {
      const streaksRes = await authFetch(`${API}/streaks`);
      if (streaksRes?.ok) {
        const data = await streaksRes.json();
        setStreaksAndBadges(data);
        if (userId) {
          const prev = readPageCache(userId, CACHE_KEY) || emptyDashboardPayload();
          writePageCache(userId, CACHE_KEY, { ...prev, streaksAndBadges: data });
        }
      }
    } catch (_) {}
  }, [user, userId, authFetch]);

  useEffect(() => {
    fetchDashboardData();
    const fallback = window.setTimeout(() => setLoading(false), MAX_SKELETON_MS);
    return () => window.clearTimeout(fallback);
  }, [fetchDashboardData]);

  useEffect(() => {
    const onFocus = () => refreshStreaks();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshStreaks();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(refreshStreaks, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [refreshStreaks]);

  const setDailyTarget = useCallback(
    async (dailyTarget) => {
      setSettingTarget(true);
      try {
        const res = await authFetch(`${API}/streaks/target`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyTarget: Number(dailyTarget) }),
        });
        if (res?.ok) {
          const data = await res.json();
          setStreaksAndBadges(data);
          return { ok: true };
        }
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || 'Failed to set target' };
      } catch (error) {
        return { ok: false, error: error.message || 'Failed to set target' };
      } finally {
        setSettingTarget(false);
      }
    },
    [authFetch]
  );

  const totals = useMemo(() => {
    const totalCampaigns = emailLists.length;
    const sentMails = sendEvents.length;
    const dataExtractedTotal = extractedTotal || scans.reduce((sum, s) => sum + (s.foundCount || 0), 0);
    return { totalCampaigns, emailsExtracted: dataExtractedTotal, sentMails };
  }, [emailLists, sendEvents, extractedTotal, scans]);

  const onboarding = useMemo(() => {
    const hasScan = scans.some((s) => s.status === 'completed' || s.status === 'running' || s.processed > 0);
    const hasEmails = totals.emailsExtracted > 0;
    const hasCampaign = emailLists.length > 0;
    const hasSent = totals.sentMails > 0;

    const steps = [
      { id: 'scan', label: 'Run your first store scan', done: hasScan, to: '/app/scanner' },
      { id: 'emails', label: 'Review extracted store emails', done: hasEmails, to: '/app/stores' },
      { id: 'campaign', label: 'Create your first campaign', done: hasCampaign, to: '/app/campaigns' },
      { id: 'send', label: 'Send your first outreach email', done: hasSent, to: '/app/campaigns' },
    ];

    const allComplete = steps.every((s) => s.done);
    const hasAnyActivity = hasScan || hasEmails || hasCampaign || hasSent || activityLogs.length > 0;

    return {
      steps,
      showGuide: !hasAnyActivity,
      allComplete,
      hasAnyActivity,
    };
  }, [scans, totals, emailLists, activityLogs]);

  const recentFeed = useMemo(
    () => buildRecentActivityFeed({ scans, activityLogs }),
    [activityLogs, scans]
  );

  const metrics = useMemo(() => {
    const now = Date.now();
    const rangedLists = filterByRange(emailLists, range, now);
    const prevLists = filterByPreviousRange(emailLists, range, now);
    const rangedRuns = filterByRange(manualRuns, range, now);
    const prevRuns = filterByPreviousRange(manualRuns, range, now);
    const rangedScans = filterByRange(scans, range, now);
    const prevScans = filterByPreviousRange(scans, range, now);

    const totalCampaigns = range === 'All' ? emailLists.length : rangedLists.length;
    const prevTotalCampaigns = range === 'All' ? emailLists.length : prevLists.length;

    const activeCampaigns = countActiveManualRuns(manualRuns);
    const activeCampaignsInRange = countActiveManualRuns(rangedRuns);
    const activeCampaignsPrevRange = countActiveManualRuns(prevRuns);

    const storesScanned = sumScanProcessed(rangedScans);
    const prevStoresScanned = sumScanProcessed(prevScans);

    const dataFromScans = sumScanFound(rangedScans);
    const prevDataFromScans = sumScanFound(prevScans);
    const dataExtracted =
      range === 'All' ? extractedTotal || sumScanFound(scans) : dataFromScans;
    const prevDataExtracted =
      range === 'All' ? extractedTotal || sumScanFound(scans) : prevDataFromScans;

    const emailsSentInRange = filterSendEventsBySentRange(sendEvents, range, now).length;
    const emailsSentPrevRange = filterSendEventsBySentPreviousRange(sendEvents, range, now).length;
    const totalEmailsSent = sendEvents.length;

    const emailTemplateCount = countEmailTemplates(presets);
    const emailTemplatesInRange = countEmailTemplates(filterByRange(presets, range, now));
    const emailTemplatesPrevRange = countEmailTemplates(filterByPreviousRange(presets, range, now));

    return {
      overview: [
        {
          key: 'campaigns',
          label: 'Total campaigns',
          value: totalCampaigns.toLocaleString(),
          trend: trendDelta(totalCampaigns, prevTotalCampaigns),
          icon: 'layers',
          to: '/app/campaigns',
        },
        {
          key: 'active',
          label: 'Active campaigns',
          value: activeCampaigns.toLocaleString(),
          trend: trendDelta(activeCampaignsInRange, activeCampaignsPrevRange),
          icon: 'zap',
          to: '/app/campaigns',
        },
        {
          key: 'stores',
          label: 'Stores scanned',
          value: storesScanned.toLocaleString(),
          trend: trendDelta(storesScanned, prevStoresScanned),
          icon: 'store',
          to: '/app/stores',
        },
        {
          key: 'extracted',
          label: 'Data extracted',
          value: dataExtracted.toLocaleString(),
          trend: trendDelta(dataExtracted, prevDataExtracted),
          icon: 'mail',
          to: '/app/stores',
        },
      ],
      performance: [
        {
          key: 'emailsSent',
          label: 'Email sent',
          value: (range === 'All' ? totalEmailsSent : emailsSentInRange).toLocaleString(),
          trend: trendDelta(
            range === 'All' ? totalEmailsSent : emailsSentInRange,
            range === 'All' ? emailsSentPrevRange : emailsSentPrevRange
          ),
          to: '/app/campaigns',
        },
        {
          key: 'templates',
          label: 'Email templates',
          value: emailTemplateCount.toLocaleString(),
          trend: trendDelta(emailTemplatesInRange, emailTemplatesPrevRange),
          to: '/app/templates',
        },
      ],
      dashboardStats: [
        {
          key: 'stores',
          label: 'Stores scanned',
          value: storesScanned.toLocaleString(),
          trend: trendDelta(storesScanned, prevStoresScanned),
        },
        {
          key: 'extracted',
          label: 'Data extracted',
          value: dataExtracted.toLocaleString(),
          trend: trendDelta(dataExtracted, prevDataExtracted),
        },
        {
          key: 'sent',
          label: 'Sent mails',
          value: (range === 'All' ? totalEmailsSent : emailsSentInRange).toLocaleString(),
          trend: trendDelta(
            range === 'All' ? totalEmailsSent : emailsSentInRange,
            emailsSentPrevRange
          ),
        },
      ],
      recentCampaigns: emailLists.slice(0, 5).map((list) => ({
        id: list.id,
        name: list.name,
        createdAt: list.createdAt,
        status: 'list',
        totalQueued: list.recipients?.length ?? 0,
        sent: 0,
      })),
      recentActivity: activityLogs.slice(0, 5),
    };
  }, [emailLists, manualRuns, sendEvents, activityLogs, scans, presets, extractedTotal, range]);

  return {
    loading,
    isRevalidating,
    metrics,
    totals,
    onboarding,
    streaksAndBadges,
    setDailyTarget,
    settingTarget,
    recentFeed,
    campaigns,
    activityLogs,
    refetch: fetchDashboardData,
    refreshStreaks,
  };
}
