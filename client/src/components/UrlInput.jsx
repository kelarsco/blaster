import React, { useState, useEffect } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

function parseUrls(text) {
  const raw = (text || '').replace(/,/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const urls = [];
  for (const s of raw) {
    let u = s;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      const parsed = new URL(u);
      if (!seen.has(parsed.origin)) {
        seen.add(parsed.origin);
        urls.push(parsed.origin);
      }
    } catch (_) {}
  }
  return urls.slice(0, 1000);
}

export function UrlInput({
  onScanStart,
  onScanStatus,
  scanId,
  scanStatus,
  existingResults = [],
  existingScanId,
}) {
  const { authFetch } = useAuth();
  const [rawUrls, setRawUrls] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [emailFilters, setEmailFilters] = useState({
    includeGmail: true,
    includeOutlook: true,
    includeYahoo: true,
    includeHotmail: true,
    includeProtonmail: true,
    includeDomain: true,
  });

  const urlCount = parseUrls(rawUrls).length;
  const hasProvider = Object.values(emailFilters).some(Boolean);
  const isScanRunning = isScanning || (scanStatus && scanStatus.status === 'running');
  const isValid = urlCount >= 1 && urlCount <= 1000 && hasProvider && !isScanRunning;

  const startScan = async () => {
    setError('');
    setIsScanning(true);
    try {
      let paths, maxConcurrentCrawlers, maxUrlsPerScan;
      try {
        const rawSettings = localStorage.getItem('blaster-settings');
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          if (Array.isArray(parsed.crawledPaths)) paths = parsed.crawledPaths.filter(Boolean);
          if (typeof parsed.maxConcurrentCrawlers === 'number') maxConcurrentCrawlers = parsed.maxConcurrentCrawlers;
          if (typeof parsed.maxUrlsPerScan === 'number') maxUrlsPerScan = parsed.maxUrlsPerScan;
        }
      } catch (_) {}

      const res = await authFetch(`${API}/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawUrls,
          maxConcurrentCrawlers,
          maxUrlsPerScan,
          emailFilters: {
            includeProviders: [
              ...(emailFilters.includeGmail ? ['gmail'] : []),
              ...(emailFilters.includeOutlook ? ['outlook'] : []),
              ...(emailFilters.includeYahoo ? ['yahoo'] : []),
              ...(emailFilters.includeHotmail ? ['hotmail'] : []),
              ...(emailFilters.includeProtonmail ? ['protonmail'] : []),
              ...(emailFilters.includeDomain ? ['domain'] : []),
            ],
          },
        }),
      });

      let data = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          // Ignore JSON parse error; we'll fall back to generic message below.
        }
      }

      if (!res.ok) {
        const serverMsg = data?.error ?? data?.message ?? '';
        throw new Error(serverMsg || `Server error (${res.status}) while starting scan`);
      }

      onScanStart(data.scanId);
      setRawUrls('');
    } catch (e) {
      const msg = e?.message ?? '';
      const isNetworkError =
        e?.name === 'TypeError' ||
        /fetch|network|ECONNREFUSED|ECONNRESET/i.test(msg);
      setError(
        isNetworkError
          ? 'Backend not running. From the project root run: npm run dev (starts server + client).'
          : msg || 'Failed to start scan'
      );
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (scanStatus?.status === 'completed' || scanStatus?.status === 'failed') {
      setIsScanning(false);
    }
  }, [scanStatus?.status]);

  return (
    <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-sm card-body-mobile">
      <h2 className="card-title-mobile mb-3 md:mb-4">
        Bulk Website URLs
      </h2>
      <p className="text-xs md:text-sm text-blaster-muted mb-2 md:mb-3">
        Paste website links (one per line or comma-separated). 100–1000 URLs per scan.
      </p>
      <textarea
        value={rawUrls}
        onChange={(e) => setRawUrls(e.target.value)}
        placeholder={"https://site1.com\nhttps://site2.com\n..."}
        rows={6}
        className="w-full px-4 py-3 rounded-xl bg-blaster-input-bg border border-blaster-input-border text-blaster-fg placeholder-blaster-muted focus:outline-none focus:ring-2 focus:ring-blaster-accent/40 focus:border-blaster-accent transition"
        disabled={isScanning}
      />
      <p className="text-xs text-blaster-muted mt-2 mb-1">Extract emails from:</p>
      <div className="flex flex-wrap items-center gap-4 mt-3">
        <span className="text-sm text-blaster-muted">
          Valid URLs: <strong className="text-blaster-fg">{urlCount}</strong>
        </span>
        <label className="flex items-center gap-2 text-sm text-blaster-fg cursor-pointer">
          <input
            type="checkbox"
            checked={emailFilters.includeGmail}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeGmail: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          Gmail
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg cursor-pointer">
          <input
            type="checkbox"
            checked={emailFilters.includeOutlook}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeOutlook: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          Outlook
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg cursor-pointer">
          <input
            type="checkbox"
            checked={emailFilters.includeYahoo}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeYahoo: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          Yahoo Mail
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg cursor-pointer">
          <input
            type="checkbox"
            checked={emailFilters.includeHotmail}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeHotmail: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          Hotmail
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg cursor-pointer">
          <input
            type="checkbox"
            checked={emailFilters.includeProtonmail}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeProtonmail: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          ProtonMail
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg cursor-pointer">
          <input
            type="checkbox"
            checked={emailFilters.includeDomain}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeDomain: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          Domain mail
        </label>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={startScan}
          disabled={!isValid || isScanRunning}
          className="btn-blaster-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? 'Scanning…' : 'Start Scan'}
        </button>
      </div>
    </section>
  );
}
