import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../api.js';

export function ResultsDashboard({ scanId, scanStatus, results, onResults, onExportXml, onStartAutomation, onClearResults }) {
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [notes, setNotes] = useState({});

  useEffect(() => {
    if (!scanId) return;
    let failures = 0;
    const MAX_FAILURES = 3;
    const fetchResults = async () => {
      try {
        const res = await fetch(`${API}/scan/results/${scanId}`);
        if (!res.ok) {
          failures += 1;
          return;
        }
        failures = 0;
        const data = await res.json();
        onResults(data.results || []);
      } catch (_) {
        failures += 1;
      }
    };
    fetchResults();
    const id = setInterval(() => {
      if (failures >= MAX_FAILURES) return;
      fetchResults();
    }, 5000);
    return () => clearInterval(id);
  }, [scanId, onResults]);

  const flatRows = useMemo(() => {
    const rows = [];
    for (const store of results) {
      if (store.emails && store.emails.length) {
        for (const e of store.emails) {
          rows.push({
            storeUrl: store.storeUrl,
            email: e.email,
            sourcePage: e.sourcePage,
            hasEmail: true,
          });
        }
      } else {
        rows.push({ storeUrl: store.storeUrl, email: null, sourcePage: null, hasEmail: false });
      }
    }
    return rows;
  }, [results]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flatRows;
    const q = search.toLowerCase();
    return flatRows.filter(
      (r) =>
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.storeUrl && r.storeUrl.toLowerCase().includes(q)) ||
        (r.sourcePage && r.sourcePage.toLowerCase().includes(q))
    );
  }, [flatRows, search]);

  const domainCounts = useMemo(() => {
    const m = new Map();
    for (const r of flatRows) {
      if (r.email) {
        const d = r.email.split('@')[1] || '';
        m.set(d, (m.get(d) || 0) + 1);
      }
    }
    return m;
  }, [flatRows]);

  const toggleSelect = (email) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };
  const selectAll = () => {
    const withEmail = flatRows.filter((r) => r.email);
    setSelectedEmails(new Set(withEmail.map((r) => r.email)));
  };
  const deselectAll = () => setSelectedEmails(new Set());

  const totalWithEmail = flatRows.filter((r) => r.hasEmail).length;
  const totalStores = results.length;
  const foundCount = flatRows.filter((r) => r.email).length;

  return (
    <section className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-blaster-fg">
          Results
          {scanStatus && (
            <span className="ml-2 text-sm font-normal text-blaster-muted">
              {scanStatus.status === 'completed'
                ? `${scanStatus.processed} stores, ${scanStatus.foundCount} emails`
                : `Scanning… ${scanStatus.processed}/${scanStatus.totalUrls}`}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={onExportXml} className="px-3 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover text-sm transition">
            Export XML
          </button>
          <button
            type="button"
            onClick={onStartAutomation}
            disabled={foundCount === 0}
            className="btn-blaster-accent text-sm disabled:opacity-50"
          >
            Start Automation
          </button>
          {onClearResults && (
            <button type="button" onClick={onClearResults} className="px-3 py-2 rounded-lg border border-blaster-border text-blaster-muted hover:bg-blaster-sidebar-hover text-sm transition">
              Clear results
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or store URL…"
          className="flex-1 px-4 py-2 rounded-xl bg-blaster-input-bg border border-blaster-input-border text-blaster-fg placeholder-blaster-muted focus:outline-none focus:ring-2 focus:ring-blaster-accent/40 focus:border-blaster-accent transition"
        />
        <button type="button" onClick={selectAll} className="px-3 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover text-sm transition">
          Select all
        </button>
        <button type="button" onClick={deselectAll} className="px-3 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover text-sm transition">
          Deselect all
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        <div className="rounded-xl p-4 min-h-[320px] overflow-auto bg-blaster-input-bg/50 border border-blaster-border">
          <h3 className="text-sm font-medium text-blaster-muted mb-2">Emails ({filtered.filter((r) => r.email).length})</h3>
          <ul className="space-y-1">
            {filtered
              .filter((r) => r.email)
              .slice(0, 200)
              .map((r) => (
                <li key={`${r.storeUrl}-${r.email}`} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(r.email)}
                    onChange={() => toggleSelect(r.email)}
                    className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
                  />
                  <span className="text-blaster-fg truncate">{r.email}</span>
                  {domainCounts.get(r.email?.split('@')[1]) > 1 && (
                    <span className="text-amber-600 text-xs">duplicate domain</span>
                  )}
                </li>
              ))}
            {filtered.filter((r) => r.email).length > 200 && (
              <li className="text-blaster-muted text-sm">+ {filtered.filter((r) => r.email).length - 200} more</li>
            )}
          </ul>
        </div>
        <div className="rounded-xl p-4 min-h-[320px] overflow-auto bg-blaster-input-bg/50 border border-blaster-border">
          <h3 className="text-sm font-medium text-blaster-muted mb-2">Stores ({totalStores})</h3>
          <ul className="space-y-2">
            {results.slice(0, 100).map((store) => (
              <li key={store.storeUrl} className="text-sm">
                <a
                  href={store.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blaster-accent hover:underline truncate block"
                >
                  {store.storeUrl}
                </a>
                <span className="text-blaster-muted">
                  {store.emails?.length ? `${store.emails.length} email(s)` : 'No email found'}
                </span>
                {store.sourcePages?.length ? (
                  <span className="text-xs text-blaster-muted block">
                    Source: {store.sourcePages.slice(0, 2).join(', ')}
                  </span>
                ) : null}
              </li>
            ))}
            {results.length > 100 && (
              <li className="text-blaster-muted text-sm">+ {results.length - 100} more stores</li>
            )}
          </ul>
        </div>
      </div>

      {flatRows.some((r) => !r.hasEmail) && (
        <p className="mt-3 text-sm text-blaster-muted">
          {flatRows.filter((r) => !r.hasEmail).length} store(s) with no email found (flagged).
        </p>
      )}
    </section>
  );
}
