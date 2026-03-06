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
  const [limitReached, setLimitReached] = useState(false);
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
    setLimitReached(false);
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

      // Handle limit reached response
      if (data?.limitReached) {
        setLimitReached(true);
        setError(data.message || `Scanned ${data.scannedUrls} of ${data.totalUrls} URLs. You've reached your plan limit.`);
        setUpgradeRequired(true);
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
    <section className="bg-white rounded-2xl border border-[#e7e8f0] shadow-sm p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6d7385] mb-1">
        Input
      </h2>
      <p className="text-sm text-[#9aa0b3] mb-4">
        Paste store URLs (one per line) or upload a CSV file
      </p>
      <textarea
        value={rawUrls}
        onChange={(e) => setRawUrls(e.target.value)}
        placeholder={"https://store1.com\nhttps://store2.com\nhttps://store3.com"}
        rows={6}
        className="w-full px-4 py-3 rounded-xl bg-[#f6f7fb] border border-[#e4e7f0] text-[#222] placeholder-[#b5bbca] focus:outline-none focus:ring-2 focus:ring-[#6b6ee8]/30 focus:border-[#6b6ee8] transition"
        disabled={isScanning}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#dfe3ee] bg-[#f9faff] text-[#4f566b] hover:bg-[#f1f3fb] cursor-pointer text-sm">
            <input
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={onCsvUpload}
              className="hidden"
              disabled={isScanning}
            />
            Upload CSV
          </label>
          <span className="text-[#a3a9ba]">|</span>
          <p className="text-sm text-[#5d6377]">
            {urlCount} valid URLs
          </p>
        </div>
        <button
          type="button"
          onClick={startScan}
          disabled={!isValid || isScanRunning}
          className="px-5 py-2 rounded-[10px] bg-[#1a1a21] text-white text-sm font-semibold hover:bg-[#252530] disabled:bg-[#c7cad5] disabled:text-[#8b92a7] disabled:cursor-not-allowed transition"
        >
          {isScanning ? 'Scanning…' : 'Start Scan'}
        </button>
      </div>
      {csvName ? <p className="mt-2 text-xs text-[#8a91a5]">Loaded: {csvName}</p> : null}
      {error && (
        <div className={`mt-3 p-3 rounded-lg border text-sm ${
          limitReached 
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
        }`}>
          <p>{error}</p>
          {upgradeRequired && (
            <Link to="/app/account/pricing" className="mt-2 inline-block font-medium text-blaster-accent hover:underline">
              Upgrade plan →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
