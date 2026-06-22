import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Check, ChevronDown, ChevronUp, Loader, Clock, RefreshCw, X } from 'react-feather';
import { useAdmin } from '../../context/AdminContext.jsx';
import {
  readScrapeSessionCache,
  writeScrapeSessionCache,
  readScrapeJobId,
  writeScrapeJobId,
} from '../../utils/scrapeSessionCache.js';

const initialScrapeCache = readScrapeSessionCache();

const SOURCE_STYLES = {
  Reddit: 'border-orange-200 bg-orange-50',
  Facebook: 'border-blue-200 bg-blue-50',
  TikTok: 'border-gray-800 bg-gray-900 text-white',
  LinkedIn: 'border-sky-200 bg-sky-50',
  Twitter: 'border-slate-200 bg-slate-50',
  'Google Ads': 'border-emerald-200 bg-emerald-50',
  'Google Dork': 'border-emerald-200 bg-emerald-50',
};

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Off — manual only' },
  { value: 1440, label: 'Every 24 hours (recommended — 15 SerpAPI/day)' },
  { value: 2880, label: 'Every 48 hours' },
  { value: 10080, label: 'Every 7 days' },
];

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, '0')}s`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
    </span>
  );
}

function SourceLinksModal({ source, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!source) return null;
  const links = source.links || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-links-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[min(80vh,32rem)] flex flex-col rounded-2xl border border-blaster-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-blaster-border">
          <div>
            <h2 id="source-links-title" className="text-sm font-semibold text-blaster-fg">
              {source.name}
            </h2>
            <p className="text-xs text-blaster-muted mt-0.5">
              {links.length.toLocaleString()} link{links.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-sidebar"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="flex-1 overflow-auto divide-y divide-blaster-border">
          {links.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-blaster-muted">No links for this source.</li>
          ) : (
            links.map((lead) => (
              <li key={lead.storeUrl} className="px-5 py-2.5">
                <a
                  href={lead.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blaster-fg hover:underline break-all"
                >
                  {lead.storeUrl}
                </a>
                {lead.platformHint || lead.rawSignal ? (
                  <p className="text-[11px] text-blaster-muted mt-0.5 line-clamp-2">
                    {[lead.platformHint, lead.rawSignal].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </li>
            ))
          )}
        </ul>
        {source.linkCount > links.length ? (
          <p className="text-xs text-blaster-muted px-5 py-2 border-t border-blaster-border">
            Showing {links.length} of {source.linkCount.toLocaleString()} links
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AdminScrapeDashboardPage() {
  const { adminFetch } = useAdmin();
  const [job, setJob] = useState(initialScrapeCache?.job ?? null);
  const [settings, setSettings] = useState(
    initialScrapeCache?.settings ?? { enabled: false, intervalMinutes: 0, lastRunAt: null, nextRunAt: null }
  );
  const [serpQuota, setSerpQuota] = useState(initialScrapeCache?.serpQuota ?? null);
  const [intervalDraft, setIntervalDraft] = useState(
    initialScrapeCache?.settings?.intervalMinutes ?? 1440
  );
  const [loading, setLoading] = useState(!initialScrapeCache?.job);
  const [starting, setStarting] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [resettingQuota, setResettingQuota] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState(120);
  const [sourceModal, setSourceModal] = useState(null);

  const session = job?.session;
  const isRunning = job?.status === 'running';
  const isReady = job?.status === 'ready';
  const isAccepted = job?.status === 'accepted';
  const isFailed = job?.status === 'failed';

  const loadStatus = useCallback(async (preferredJobId) => {
    const jobId = preferredJobId || job?.id || readScrapeJobId() || '';
    const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
    try {
      const res = await adminFetch(`/lead-engine/scrape/status${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.scrapeJob) {
          if (data.scrapeJob.session?.etaSeconds != null) {
            setEtaSeconds(data.scrapeJob.session.etaSeconds);
          }
          setJob(data.scrapeJob);
          return data.scrapeJob;
        }
      }
    } catch (_) {}
    return null;
  }, [adminFetch, job?.id]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await adminFetch('/lead-engine/scrape/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
          setIntervalDraft(data.settings.intervalMinutes ?? 1440);
        }
        if (data.serpQuota) setSerpQuota(data.serpQuota);
      }
    } catch (_) {}
  }, [adminFetch]);

  useEffect(() => {
    if (!job) return;
    writeScrapeJobId(job.id);
    writeScrapeSessionCache({ job, serpQuota, settings });
  }, [job, serpQuota, settings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedJobId = readScrapeJobId();
      await loadStatus(storedJobId || undefined);
      if (!cancelled) await loadSettings();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRunning && !starting) return undefined;
    loadStatus();
    const poll = setInterval(() => loadStatus(), 2000);
    return () => clearInterval(poll);
  }, [isRunning, starting, loadStatus]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isRunning && !starting) return undefined;
    const startMs = new Date(job?.startedAt || session?.startedAt || Date.now()).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, starting, job?.startedAt, session?.startedAt]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const id = setInterval(() => {
      setEtaSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const startScrape = async () => {
    setStarting(true);
    setError('');
    setMessage('');
    try {
      const res = await adminFetch('/lead-engine/scrape/start', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to start scrape');
      setEtaSeconds(15 * 18);
      if (data.jobId) {
        writeScrapeJobId(data.jobId);
        const statusRes = await adminFetch(`/lead-engine/scrape/status?jobId=${encodeURIComponent(data.jobId)}`);
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.scrapeJob) setJob(statusData.scrapeJob);
      } else if (data.scrapeJob) {
        setJob(data.scrapeJob);
      } else {
        await loadStatus();
      }
      if (data.message) setMessage(data.message);
      await loadSettings();
    } catch (e) {
      setError(e.message || 'Failed to start');
    }
    setStarting(false);
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    setError('');
    try {
      const enabled = intervalDraft > 0;
      const res = await adminFetch('/lead-engine/scrape/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, intervalMinutes: intervalDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save schedule');
      if (data.settings) {
        setSettings(data.settings);
        setIntervalDraft(data.settings.intervalMinutes ?? 1440);
      }
      if (data.serpQuota) setSerpQuota(data.serpQuota);
      setMessage(
        enabled
          ? `Automation enabled — scrapes every ${INTERVAL_OPTIONS.find((o) => o.value === intervalDraft)?.label?.replace('Every ', '') || `${intervalDraft}m`}`
          : 'Automation disabled — manual runs only'
      );
    } catch (e) {
      setError(e.message || 'Failed to save schedule');
    }
    setSavingSchedule(false);
  };

  const resetDailyQuota = async () => {
    setResettingQuota(true);
    setError('');
    try {
      const res = await adminFetch('/lead-engine/scrape/quota/reset', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to reset quota');
      if (data.serpQuota) setSerpQuota(data.serpQuota);
      setMessage(data.message || "Today's SerpAPI quota reset.");
      await loadSettings();
    } catch (e) {
      setError(e.message || 'Failed to reset quota');
    }
    setResettingQuota(false);
  };

  const acceptLeads = async () => {
    if (!job?.id) return;
    setAccepting(true);
    setError('');
    try {
      const res = await adminFetch('/lead-engine/scrape/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add leads');
      setMessage(data.message || 'Leads added successfully');
      await loadStatus();
    } catch (e) {
      setError(e.message || 'Failed to accept leads');
    }
    setAccepting(false);
  };

  const sources = useMemo(() => {
    const raw = session?.sources ?? [];
    return raw
      .filter((s) => s.name !== 'Seed list' && s.id !== 'seed')
      .map((s) => ({
        ...s,
        linkCount: s.count,
        links:
          s.links ||
          (session?.verifiedLeads || []).filter((l) => l.source === s.name).slice(0, 500),
      }));
  }, [session?.sources, session?.verifiedLeads]);

  const scrapedTotal = useMemo(() => {
    if (isRunning && session?.linksFound != null) return session.linksFound;
    if (sources.length > 0) return sources.reduce((sum, s) => sum + (s.count || 0), 0);
    const all = (session?.sources ?? []).filter((s) => s.name !== 'Seed list' && s.id !== 'seed');
    if (all.length) return all.reduce((sum, s) => sum + (s.count || 0), 0);
    return session?.totalGenerated ?? job?.urlsFound ?? 0;
  }, [isRunning, session?.linksFound, sources, session?.sources, session?.totalGenerated, job?.urlsFound]);

  const progress = session?.progressPercent ?? (isRunning ? 12 : isReady || isAccepted ? 100 : 0);
  const validation = session?.validation ?? {};
  const verifiedCount = validation.verifiedCount ?? 0;
  const googleAds = session?.modules?.googleAds || session?.modules?.googleDork;
  const quota = googleAds?.quota || serpQuota;

  const adsStep =
    session?.adsQueryIndex && session?.adsQueryTotal
      ? `${session.adsQueryIndex} / ${session.adsQueryTotal}`
      : null;

  const statusLabel = useMemo(() => {
    if (isFailed) return 'Scrape failed';
    if (isAccepted) return 'Completed — leads added to website';
    if (isReady) return 'Scraping complete — ready for review';
    if (isRunning) return session?.statusLabel || 'Scraping in progress…';
    return 'No active session';
  }, [isFailed, isAccepted, isReady, isRunning, session?.statusLabel]);

  const automationOn = settings.enabled && settings.intervalMinutes > 0;

  if (loading && !job) {
    return <p className="text-sm text-blaster-muted">Loading scraping dashboard…</p>;
  }

  const showEmpty = !job || (!isRunning && !isReady && !isAccepted && !isFailed && !starting);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/bl-admin/lead-engine"
            className="inline-flex items-center gap-1.5 text-xs text-blaster-muted hover:text-blaster-fg mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Lead Engine
          </Link>
          <h1 className="text-xl font-semibold text-blaster-fg">Internet Scraping Dashboard</h1>
          <p className="text-sm text-blaster-muted mt-1">
            One daily run uses 15 Google Ads Transparency Center searches to find active ecommerce storefronts
            (past 24h + past 6 days), then validates against your database.
          </p>
        </div>
      </div>

      {/* Automation + manual run controls */}
      <div className="rounded-2xl border border-blaster-border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="scrape-interval" className="block text-xs font-medium text-blaster-muted mb-1.5">
              <Clock className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
              Automation interval
            </label>
            <select
              id="scrape-interval"
              value={intervalDraft}
              onChange={(e) => setIntervalDraft(Number(e.target.value))}
              className="w-full rounded-lg border border-blaster-border bg-white px-3 py-2 text-sm text-blaster-fg"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={saveSchedule}
            disabled={savingSchedule}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blaster-border bg-blaster-sidebar hover:bg-white disabled:opacity-50"
          >
            {savingSchedule ? 'Saving…' : 'Save automation'}
          </button>
          <button
            type="button"
            onClick={startScrape}
            disabled={starting || isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blaster-fg text-white hover:opacity-90 disabled:opacity-50"
          >
            {starting || isRunning ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? 'Scraping…' : starting ? 'Starting…' : 'Run scrape now'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-blaster-muted">
          <span>
            Automation:{' '}
            <span className={automationOn ? 'text-green-700 font-medium' : 'text-blaster-fg'}>
              {automationOn ? 'On' : 'Off'}
            </span>
          </span>
          {settings.lastRunAt ? <span>Last run: {formatWhen(settings.lastRunAt)}</span> : null}
          {automationOn && settings.nextRunAt ? <span>Next run: {formatWhen(settings.nextRunAt)}</span> : null}
          {quota ? (
            <span>
              SerpAPI today:{' '}
              <span className="text-blaster-fg font-medium">
                {quota.usedToday}/{quota.dailyBudget}
              </span>
              {' · '}
              month: {quota.usedMonth}/{quota.monthlyQuota}
            </span>
          ) : null}
        </div>
        {quota && quota.remainingToday <= 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="flex-1 min-w-[200px]">
              Today&apos;s SerpAPI budget is used ({quota.dailyBudget} searches/day). Reset to run another full scan,
              or wait until tomorrow.
            </p>
            <button
              type="button"
              onClick={resetDailyQuota}
              disabled={resettingQuota || isRunning}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 font-medium hover:bg-amber-100 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resettingQuota ? 'animate-spin' : ''}`} />
              {resettingQuota ? 'Resetting…' : 'Reset today\'s quota (15)'}
            </button>
          </div>
        ) : null}
        {googleAds?.skipped && !isRunning ? (
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Google Ads scraper skipped — set <code className="text-[11px]">SERPAPI_KEY</code> to your SerpApi private
            key (not a URL). {googleAds.reason ? `(${googleAds.reason})` : ''}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-3">{message}</p>
      ) : null}

      {showEmpty ? (
        <div className="rounded-2xl border border-dashed border-blaster-border bg-white py-16 px-6 text-center">
          <RefreshCw className="w-8 h-8 text-blaster-muted mx-auto mb-3" />
          <p className="text-sm font-medium text-blaster-fg">Ready to scrape</p>
          <p className="text-xs text-blaster-muted mt-1 max-w-md mx-auto">
            Set automation to <strong>Every 24 hours</strong>, save, then click <strong>Run scrape now</strong>. Each
            daily run uses 15 Google Ads searches (Shopping + Search, 24h and 6-day windows).
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
            <div className="px-6 py-8 sm:py-10 text-center border-b border-blaster-border bg-gradient-to-b from-blaster-sidebar/40 to-white">
              <p className="text-xs uppercase tracking-wider text-blaster-muted font-medium">Total links generated</p>
              <p className="text-5xl sm:text-6xl font-bold text-blaster-fg mt-2 tracking-tight">
                {scrapedTotal.toLocaleString()}
              </p>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-blaster-muted">
                {isRunning ? <LivePulse /> : isAccepted ? <Check className="w-4 h-4 text-green-600" /> : null}
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>

          {sources.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-blaster-fg mb-3">Source breakdown</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {sources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() =>
                      setSourceModal({
                        name: src.name,
                        links: src.links,
                        linkCount: src.linkCount ?? src.count,
                      })
                    }
                    className={`rounded-xl border p-4 text-left transition-shadow hover:shadow-md cursor-pointer ${
                      SOURCE_STYLES[src.name] || 'border-blaster-border bg-white'
                    }`}
                  >
                    <p className={`text-xs font-medium ${src.name === 'TikTok' ? 'text-gray-300' : 'text-blaster-muted'}`}>
                      {src.name}
                    </p>
                    <p className={`text-2xl font-semibold mt-1 ${src.name === 'TikTok' ? 'text-white' : 'text-blaster-fg'}`}>
                      {src.count.toLocaleString()}
                    </p>
                    <p className={`text-[10px] mt-1 ${src.name === 'TikTok' ? 'text-gray-400' : 'text-blaster-muted'}`}>
                      {src.percent}% of total · click to view links
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-blaster-border bg-white p-5 sm:p-6">
            {isRunning ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-emerald-900">
                    <Loader className="w-4 h-4 animate-spin" />
                    Live scrape
                  </span>
                  {adsStep ? (
                    <span className="text-emerald-800">
                      SerpAPI search <strong>{adsStep}</strong>
                    </span>
                  ) : null}
                  <span className="text-emerald-800">
                    Elapsed <strong>{formatDuration(elapsedSeconds)}</strong>
                  </span>
                  <span className="text-emerald-800">
                    Links so far <strong>{(session?.linksFound ?? 0).toLocaleString()}</strong>
                  </span>
                </div>
                <p className="text-xs text-emerald-900/80 mt-2">{statusLabel}</p>
                <p className="text-[11px] text-emerald-900/60 mt-1">
                  Each SerpAPI call can take 15–45s. Progress updates every few seconds — not frozen.
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs text-blaster-muted">Time remaining (estimate)</p>
                <p className="text-2xl font-semibold text-blaster-fg mt-0.5">
                  {isRunning ? formatDuration(etaSeconds) : isReady || isAccepted ? '0m 00s' : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blaster-muted">Progress</p>
                <p className="text-2xl font-semibold text-blaster-fg mt-0.5">{progress}%</p>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-blaster-sidebar overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFailed ? 'bg-red-500' : isAccepted ? 'bg-green-500' : 'bg-blaster-accent'
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <p className="text-xs text-blaster-muted mt-3 flex items-center gap-2">
              {isRunning ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
              {isFailed && job?.errorMessage ? job.errorMessage : statusLabel}
            </p>
            {googleAds && !googleAds.skipped && googleAds.stats ? (
              <p className="text-[11px] text-blaster-muted mt-2">
                Google Ads ({googleAds.mode || 'daily'}): {googleAds.stats.uniqueHits?.toLocaleString() ?? 0} store
                domains · {googleAds.stats.serpRequestsUsed ?? 0}/15 SerpAPI searches · windows: 24h + 6 days
              </p>
            ) : null}
          </div>

          {(isReady || isAccepted || validation.verifiedCount != null) && (
            <div>
              <h2 className="text-sm font-semibold text-blaster-fg mb-3">Data validation pipeline</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-blaster-border bg-white p-5">
                  <p className="text-xs font-medium text-blaster-muted">Duplicate detection</p>
                  <p className="text-3xl font-semibold text-blaster-fg mt-2">
                    {(validation.duplicatesInBatch ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-blaster-muted mt-2">Links removed within this batch</p>
                </div>
                <div className="rounded-2xl border border-blaster-border bg-white p-5">
                  <p className="text-xs font-medium text-blaster-muted">Database cross-check (7 days)</p>
                  <p className="text-3xl font-semibold text-blaster-fg mt-2">
                    {(validation.dbRecentDuplicates ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-blaster-muted mt-2">Already in database — filtered out</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                  <p className="text-xs font-medium text-amber-900/70">Final verified leads</p>
                  <p className="text-3xl font-semibold text-blaster-fg mt-2">{verifiedCount.toLocaleString()}</p>
                  <p className="text-[11px] text-amber-900/60 mt-2">Ready for verification</p>
                </div>
              </div>
            </div>
          )}

          {(isReady || isAccepted) && verifiedCount > 0 && (
            <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
              <div className="px-6 py-6 border-b border-blaster-border bg-blaster-sidebar/30">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="w-5 h-5" />
                  <span className="text-lg font-semibold">Verified leads: {verifiedCount.toLocaleString()}</span>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-blaster-muted">
                  <li>✓ Total links passed all checks</li>
                  <li>✓ Not in database</li>
                  <li>✓ Not duplicated in batch</li>
                </ul>
              </div>
              <div className="px-6 py-5 flex flex-wrap gap-3 items-center">
                {!isAccepted ? (
                  <button
                    type="button"
                    onClick={acceptLeads}
                    disabled={accepting || !isReady}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {accepting ? 'Adding…' : 'Accept & add these leads to website'}
                  </button>
                ) : (
                  <p className="text-sm text-green-800 font-medium">
                    ✓ {job.storesAdded?.toLocaleString() ?? verifiedCount.toLocaleString()} leads added
                    {session?.acceptedAt ? ` · ${new Date(session.acceptedAt).toLocaleString()}` : ''}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-blaster-border hover:bg-blaster-sidebar"
                >
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Review details
                </button>
              </div>
              {showDetails && session?.verifiedLeads?.length > 0 ? (
                <div className="border-t border-blaster-border max-h-80 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-blaster-sidebar text-left text-xs text-blaster-muted sticky top-0">
                      <tr>
                        <th className="px-4 py-2">Store URL</th>
                        <th className="px-4 py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blaster-border">
                      {session.verifiedLeads.slice(0, 200).map((lead) => (
                        <tr key={lead.storeUrl} className="hover:bg-blaster-sidebar/40">
                          <td className="px-4 py-2 max-w-md truncate">
                            <a
                              href={lead.storeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blaster-fg hover:underline"
                            >
                              {lead.storeUrl}
                            </a>
                          </td>
                          <td className="px-4 py-2 text-blaster-muted">{lead.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {session.verifiedLeads.length > 200 ? (
                    <p className="text-xs text-blaster-muted px-4 py-2 border-t border-blaster-border">
                      Showing 200 of {session.verifiedLeads.length.toLocaleString()} leads
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {isFailed ? (
            <button
              type="button"
              onClick={startScrape}
              disabled={starting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blaster-border bg-white hover:bg-blaster-sidebar"
            >
              <Play className="w-4 h-4" />
              Retry scraping session
            </button>
          ) : null}
        </>
      )}

      <SourceLinksModal source={sourceModal} onClose={() => setSourceModal(null)} />
    </div>
  );
}
