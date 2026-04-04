import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, X } from 'react-feather';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';

const URL_TOKEN_REGEX = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

function normalizeStoreUrl(input) {
  const raw = (input || '').trim().replace(/^[\s"'`<>()\[\]]+|[\s"'`<>()\[\]]+$/g, '');
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return '';
  
  // Ensure URL has protocol
  if (!url.match(/^https?:\/\//)) {
    url = 'https://' + url;
  }
  
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
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
    // Prevent multiple scans
    if (isScanning) {
      console.log('⚠️ Scan already in progress, ignoring request');
      return;
    }

    setError('');
    setUpgradeRequired(false);
    setLimitReached(false);
    setIsScanning(true);
    
    try {
      let maxConcurrentCrawlers = 5;
      let maxUrlsPerScan = 1000;

      // Try to get settings from localStorage for scan configuration
      try {
        const rawSettings = localStorage.getItem('blaster-settings');
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          if (typeof parsed.maxConcurrentCrawlers === 'number') maxConcurrentCrawlers = parsed.maxConcurrentCrawlers;
          if (typeof parsed.maxUrlsPerScan === 'number') maxUrlsPerScan = parsed.maxUrlsPerScan;
        }
      } catch (_) {}

      const urls = parseUrls(rawUrls);
      console.log('🔍 Starting scan with config:', { maxConcurrentCrawlers, maxUrlsPerScan, urlCount: urls.length });

      // Use Railway API to start scan
      const res = await authFetch(`${API}/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          maxConcurrentCrawlers,
          maxUrlsPerScan,
        }),
      });

      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        if (res.status === 402) {
          setUpgradeRequired(true);
          return;
        }
        if (res.status === 429) {
          setLimitReached(true);
          return;
        }
        throw new Error(data.error || 'Failed to start scan');
      }

      if (data.scanId) {
        onScanStart(data.scanId);
      }

    } catch (error) {
      console.error('Scan start error:', error);
      setError(error.message || 'Failed to start scan');
      setIsScanning(false);
    }
  };

  // Reset scan state on component mount
  useEffect(() => {
    // Reset scanning state on mount to handle reload issues
    setIsScanning(false);
    setError('');
    setUpgradeRequired(false);
    setLimitReached(false);
  }, []);

  useEffect(() => {
    if (scanStatus?.status === 'completed' || scanStatus?.status === 'failed') {
      setIsScanning(false);
    }
  }, [scanStatus?.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsScanning(false);
    };
  }, []);

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
