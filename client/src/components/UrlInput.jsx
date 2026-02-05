import React, { useState, useEffect } from 'react';
import { API } from '../api.js';

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

export function UrlInput({ onScanStart, onScanStatus, scanId, existingResults = [], existingScanId }) {
  const [rawUrls, setRawUrls] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [emailFilters, setEmailFilters] = useState({
    includeSupport: true,
    includeInfo: true,
    includeContact: true,
    includeNoreply: false,
  });

  const urlCount = parseUrls(rawUrls).length;
  const isValid = urlCount >= 1 && urlCount <= 1000;

  const startScan = async () => {
    setError('');
    setIsScanning(true);
    try {
      const excludeStoreUrls = (existingResults || []).map((s) => s.storeUrl).filter(Boolean);
      const res = await fetch(`${API}/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawUrls,
          excludeStoreUrls,
          previousScanId: existingScanId || undefined,
          emailFilters: {
            includeTypes: [
              ...(emailFilters.includeSupport ? ['contact'] : []),
              ...(emailFilters.includeInfo ? ['contact'] : []),
              ...(emailFilters.includeContact ? ['contact'] : []),
              ...(emailFilters.includeNoreply ? ['noreply'] : []),
              'other',
            ].filter((_, i, a) => a.indexOf(_) === i),
            excludeTypes: emailFilters.includeNoreply ? [] : ['noreply'],
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
      pollStatus(data.scanId);
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

  const POLL_MAX_FAILURES = 5;

  const pollStatus = async (id) => {
    let failures = 0;
    const tick = async () => {
      try {
        const res = await fetch(`${API}/scan/status/${id}`);
        const data = res.ok ? await res.json() : null;
        if (!res.ok) {
          failures += 1;
          if (res.status === 404) {
            setIsScanning(false);
            setError('Scan not found.');
            return;
          }
          if (failures >= POLL_MAX_FAILURES) {
            setIsScanning(false);
            setError('Cannot reach server. From project root run: npm run dev');
            return;
          }
          setTimeout(tick, 3000);
          return;
        }
        failures = 0;
        onScanStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsScanning(false);
          return;
        }
      } catch (_) {
        failures += 1;
        if (failures >= POLL_MAX_FAILURES) {
          setIsScanning(false);
          setError('Cannot reach server. From project root run: npm run dev');
          return;
        }
        setTimeout(tick, 3000);
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
  };

  useEffect(() => {
    if (scanId && isScanning) pollStatus(scanId);
  }, [scanId]);

  return (
    <section className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-sm p-6">
      <h2 className="text-lg font-semibold text-blaster-fg mb-4">
        Bulk Store URLs
      </h2>
      <p className="text-sm text-blaster-muted mb-3">
        Paste store links (one per line or comma-separated). 100–1000 URLs per scan.
      </p>
      <textarea
        value={rawUrls}
        onChange={(e) => setRawUrls(e.target.value)}
        placeholder={"https://store1.com\nhttps://store2.com\n..."}
        rows={6}
        className="w-full px-4 py-3 rounded-xl bg-blaster-input-bg border border-blaster-input-border text-blaster-fg placeholder-blaster-muted focus:outline-none focus:ring-2 focus:ring-blaster-accent/40 focus:border-blaster-accent transition"
        disabled={isScanning}
      />
      <div className="flex flex-wrap items-center gap-4 mt-3">
        <span className="text-sm text-blaster-muted">
          Valid URLs: <strong className="text-blaster-fg">{urlCount}</strong>
        </span>
        <label className="flex items-center gap-2 text-sm text-blaster-fg">
          <input
            type="checkbox"
            checked={emailFilters.includeSupport}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeSupport: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          support@
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg">
          <input
            type="checkbox"
            checked={emailFilters.includeInfo}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeInfo: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          info@
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg">
          <input
            type="checkbox"
            checked={emailFilters.includeContact}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeContact: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          contact@
        </label>
        <label className="flex items-center gap-2 text-sm text-blaster-fg">
          <input
            type="checkbox"
            checked={emailFilters.includeNoreply}
            onChange={(e) => setEmailFilters((f) => ({ ...f, includeNoreply: e.target.checked }))}
            className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
          />
          noreply@
        </label>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={startScan}
          disabled={!isValid || isScanning}
          className="btn-blaster-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? 'Scanning…' : 'Start Scan'}
        </button>
      </div>
    </section>
  );
}
