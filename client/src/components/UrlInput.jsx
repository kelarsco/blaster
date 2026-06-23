import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';

function normalizeStoreUrl(input) {
  const raw = (input || '').trim().replace(/^[\s"'`<>()\[\]]+|[\s"'`<>()\[\]]+$/g, '');
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  
  // Ensure URL has protocol
  if (!url.match(/^https?:\/\//)) {
    url = 'https://' + url;
  }
  
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return null;
    return `https://${host}`;
  } catch {
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
  const isScanRunning =
    isScanning || (scanStatus && ['running', 'pending'].includes(scanStatus.status));
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
    if (isScanning) return;

    setError('');
    setUpgradeRequired(false);
    setLimitReached(false);
    setIsScanning(true);
    
    try {
      const maxUrlsPerScan = 1000;

      const urls = parseUrls(rawUrls);

      // Validate we have valid URLs
      if (urls.length === 0) {
        throw new Error('No valid URLs provided. Please enter valid store URLs (e.g., amazon.com, shopify.com)');
      }

      const requestBody = {
        rawUrls: urls.join('\n'),
        maxUrlsPerScan,
      };

      const res = await authFetch(`${API}/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      let data;
      try {
        const responseText = await res.text();
        data = JSON.parse(responseText);
      } catch {
        data = { error: 'Invalid backend response' };
      }
      
      if (!res.ok) {
        if (res.status === 402) {
          setUpgradeRequired(true);
          setIsScanning(false);
          return;
        }
        if (res.status === 429) {
          setLimitReached(true);
          setIsScanning(false);
          return;
        }
        if (res.status === 400) {
          throw new Error(data.error || 'Invalid URLs provided. Please check your input and try again.');
        }
        if (res.status === 503 || res.status === 502) {
          throw new Error('Cannot reach the API server. Run npm run dev from the project root.');
        }
        throw new Error(data.error || `Failed to start scan (${res.status})`);
      }

      if (data.scanId) {
        onScanStart(data.scanId);
      }

    } catch (error) {
      console.error('Scan start error:', error);
      const msg = error?.message || '';
      if (/failed to fetch|network|load failed/i.test(msg)) {
        setError('Cannot reach the API server. Run npm run dev from the project root (or cd server && npm run dev in a separate terminal).');
      } else {
        setError(msg || 'Failed to start scan');
      }
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
