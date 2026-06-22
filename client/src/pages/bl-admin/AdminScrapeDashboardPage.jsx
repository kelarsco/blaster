import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Check, ChevronDown, ChevronUp, Loader } from 'react-feather';
import { useAdmin } from '../../context/AdminContext.jsx';

const SOURCE_STYLES = {
  Reddit: 'border-orange-200 bg-orange-50',
  Facebook: 'border-blue-200 bg-blue-50',
  TikTok: 'border-gray-800 bg-gray-900 text-white',
  LinkedIn: 'border-sky-200 bg-sky-50',
  Twitter: 'border-slate-200 bg-slate-50',
  'Seed list': 'border-violet-200 bg-violet-50',
};

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, '0')}s`;
}

function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
    </span>
  );
}

export function AdminScrapeDashboardPage() {
  const { adminFetch } = useAdmin();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState(90);

  const session = job?.session;
  const isRunning = job?.status === 'running';
  const isReady = job?.status === 'ready';
  const isAccepted = job?.status === 'accepted';
  const isFailed = job?.status === 'failed';

  const loadStatus = useCallback(async () => {
    try {
      const query = job?.id ? `?jobId=${encodeURIComponent(job.id)}` : '';
      const res = await adminFetch(`/lead-engine/scrape/status${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.scrapeJob) setJob(data.scrapeJob);
      }
    } catch (_) {}
    setLoading(false);
  }, [adminFetch, job?.id]);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!isRunning) return undefined;
    const poll = setInterval(loadStatus, 2000);
    return () => clearInterval(poll);
  }, [isRunning, loadStatus]);

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
      setEtaSeconds(90);
      if (data.jobId) {
        const statusRes = await adminFetch(`/lead-engine/scrape/status?jobId=${encodeURIComponent(data.jobId)}`);
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.scrapeJob) setJob(statusData.scrapeJob);
      } else {
        await loadStatus();
      }
    } catch (e) {
      setError(e.message || 'Failed to start');
    }
    setStarting(false);
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

  const totalGenerated = session?.totalGenerated ?? job?.urlsFound ?? 0;
  const progress = session?.progressPercent ?? (isRunning ? 12 : isReady || isAccepted ? 100 : 0);
  const sources = session?.sources ?? [];
  const validation = session?.validation ?? {};
  const verifiedCount = validation.verifiedCount ?? 0;

  const statusLabel = useMemo(() => {
    if (isFailed) return 'Scrape failed';
    if (isAccepted) return 'Completed — leads added to website';
    if (isReady) return 'Scraping complete — ready for review';
    if (isRunning) return session?.statusLabel || 'Scraping in progress…';
    return 'No active session';
  }, [isFailed, isAccepted, isReady, isRunning, session?.statusLabel]);

  if (loading && !job) {
    return <p className="text-sm text-blaster-muted">Loading scraping dashboard…</p>;
  }

  const showEmpty = !job || (!isRunning && !isReady && !isAccepted && !isFailed);

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
            Discover store links from configured sources, validate them, then add clean leads to the pipeline.
          </p>
        </div>
        {showEmpty ? (
          <button
            type="button"
            onClick={startScrape}
            disabled={starting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blaster-fg text-white hover:opacity-90 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {starting ? 'Starting…' : 'Start scraping session'}
          </button>
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
          <p className="text-sm font-medium text-blaster-fg">No scraping session yet</p>
          <p className="text-xs text-blaster-muted mt-1 max-w-md mx-auto">
            Start a session to collect links from seed URLs and discovery pages, run duplicate and database checks, then
            accept verified leads into the Lead Engine pipeline.
          </p>
        </div>
      ) : (
        <>
          {/* Section 1: Overview */}
          <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
            <div className="px-6 py-8 sm:py-10 text-center border-b border-blaster-border bg-gradient-to-b from-blaster-sidebar/40 to-white">
              <p className="text-xs uppercase tracking-wider text-blaster-muted font-medium">Total links generated</p>
              <p className="text-5xl sm:text-6xl font-bold text-blaster-fg mt-2 tracking-tight">
                {totalGenerated.toLocaleString()}
              </p>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-blaster-muted">
                {isRunning ? <LivePulse /> : isAccepted ? <Check className="w-4 h-4 text-green-600" /> : null}
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Source breakdown */}
          {sources.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-blaster-fg mb-3">Source breakdown</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className={`rounded-xl border p-4 ${SOURCE_STYLES[src.name] || 'border-blaster-border bg-white'}`}
                  >
                    <p className={`text-xs font-medium ${src.name === 'TikTok' ? 'text-gray-300' : 'text-blaster-muted'}`}>
                      {src.name}
                    </p>
                    <p className={`text-2xl font-semibold mt-1 ${src.name === 'TikTok' ? 'text-white' : 'text-blaster-fg'}`}>
                      {src.count.toLocaleString()}
                    </p>
                    <p className={`text-[10px] mt-1 ${src.name === 'TikTok' ? 'text-gray-400' : 'text-blaster-muted'}`}>
                      {src.percent}% of total
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Section 3: Timer & progress */}
          <div className="rounded-2xl border border-blaster-border bg-white p-5 sm:p-6">
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
          </div>

          {/* Section 4: Validation pipeline */}
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

          {/* Section 5: Accept */}
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
                    {session?.acceptedAt
                      ? ` · ${new Date(session.acceptedAt).toLocaleString()}`
                      : ''}
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
    </div>
  );
}
