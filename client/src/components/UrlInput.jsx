import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const URL_TOKEN_REGEX = /(https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"'`]*)?)/i;

function normalizeStoreUrl(input) {
  const raw = (input || '').trim().replace(/^[\s"'`<>()\[\]]+|[\s"'`<>()\[\]]+$/g, '');
  if (!raw) return null;
  const token = raw.match(URL_TOKEN_REGEX)?.[0] || raw;
  const withScheme = /^https?:\/\//i.test(token) ? token : `https://${token}`;
  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return null;
    return `https://${host}`;
  } catch (_) {
    return null;
  }
}

function parseUrls(text) {
  const raw = (text || '')
    .replace(/,/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const urls = [];
  for (const s of raw) {
    const normalized = normalizeStoreUrl(s);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
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
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [csvName, setCsvName] = useState('');

  const urlCount = parseUrls(rawUrls).length;
  const isScanRunning = isScanning || (scanStatus && scanStatus.status === 'running');
  const isValid = urlCount >= 1 && urlCount <= 1000 && !isScanRunning;

  const onCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cells = text.split(/[\n,\r\t;]+/).map((item) => item.trim()).filter(Boolean);
      const merged = [rawUrls, ...cells].filter(Boolean).join('\n');
      const normalizedUrls = parseUrls(merged);
      setRawUrls(normalizedUrls.join('\n'));
      setCsvName(file.name);
      setError('');
    } catch (_) {
      setError('Failed to read CSV file. Please upload a valid CSV with store URLs.');
    } finally {
      event.target.value = '';
    }
  };

  const startScan = async () => {
    setError('');
    setUpgradeRequired(false);
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
          forceRefresh: true,
          useCache: false,
          emailFilters: { includeProviders: [], onePerStore: true },
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
        if (data?.upgradeRequired) {
          setError(data.error || "You've reached your free plan limit. Upgrade to continue scanning.");
          setUpgradeRequired(true);
        } else {
          setError(data?.error ?? data?.message ?? `Server error (${res.status}) while starting scan`);
        }
        setIsScanning(false);
        return;
      }

      onScanStart(data.scanId);
      setRawUrls('');
      setCsvName('');
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
        Paste website links (one per line), or upload a CSV. URLs are normalized to HTTPS base domains.
      </p>
      <textarea
        value={rawUrls}
        onChange={(e) => setRawUrls(e.target.value)}
        placeholder={"https://site1.com\nhttps://site2.com\n..."}
        rows={6}
        className="w-full px-4 py-3 rounded-xl bg-blaster-input-bg border border-blaster-input-border text-blaster-fg placeholder-blaster-muted focus:outline-none focus:ring-2 focus:ring-blaster-accent/40 focus:border-blaster-accent transition"
        disabled={isScanning}
      />
      <div className="mt-3">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover cursor-pointer text-sm">
          <input
            type="file"
            accept=".csv,text/csv,.txt"
            onChange={onCsvUpload}
            className="hidden"
            disabled={isScanning}
          />
          Upload CSV
        </label>
        {csvName ? <span className="ml-2 text-xs text-blaster-muted">Loaded: {csvName}</span> : null}
      </div>
      <p className="text-xs text-blaster-muted mt-2 mb-3">
        Scanner checks privacy pages first, applies ordered fallback paths, and picks one best email per store.
      </p>
      <p className="text-sm text-blaster-muted">
        Valid URLs: <strong className="text-blaster-fg">{urlCount}</strong>
      </p>
      {error && (
        <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm">
          <p>{error}</p>
          {upgradeRequired && (
            <Link to="/app/account/billing/monthly-plan" className="mt-2 inline-block font-medium text-blaster-accent hover:underline">
              Upgrade plan →
            </Link>
          )}
        </div>
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
