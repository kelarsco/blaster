import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const INITIAL_VISIBLE = 100;

export function ResultsDashboard({
  scanId,
  scanStatus,
  results,
  onResults,
  onExportExcel,
  onStartAutomation,
  onClearResults,
}) {
  const { authFetch } = useAuth();
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState({});
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState({ storeUrl: true, email: true });
  const [emailsVisible, setEmailsVisible] = useState(INITIAL_VISIBLE);
  const [storesVisible, setStoresVisible] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    setEmailsVisible(INITIAL_VISIBLE);
    setStoresVisible(INITIAL_VISIBLE);
  }, [scanId]);

  useEffect(() => {
    if (!scanId || !authFetch) return;
    let failures = 0;
    const MAX_FAILURES = 3;
    const fetchResults = async () => {
      try {
        const res = await authFetch(`${API}/scan/results/${scanId}`);
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
  }, [scanId, onResults, authFetch]);

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

  const canStartAutomation = scanStatus?.status === 'completed' && flatRows.some((r) => r.email);

  const handleConfirmExport = () => {
    const fields = [];
    if (exportFields.storeUrl) fields.push('storeUrl');
    if (exportFields.email) fields.push('email');
    if (!fields.length) return;
    if (onExportExcel) onExportExcel(fields);
    setExportOpen(false);
  };

  const totalStores = results.length;
  const foundCount = flatRows.filter((r) => r.email).length;

  return (
    <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-sm card-body-mobile">
      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4 mb-3 md:mb-4">
        <h2 className="card-title-mobile flex items-center gap-2">
          <span>Results</span>
          {scanStatus && (
            <span className="ml-1 text-sm font-normal text-blaster-muted flex items-center gap-1.5">
              {scanStatus.status === 'completed'
                ? `${scanStatus.processed} stores, ${scanStatus.foundCount} emails`
                : `Scanning… ${scanStatus.processed}/${scanStatus.totalUrls}`}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="px-3 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover text-sm transition"
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={onStartAutomation}
            disabled={!canStartAutomation}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        <div className="rounded-xl p-4 min-h-[320px] overflow-auto bg-blaster-input-bg/50 border border-blaster-border">
          <h3 className="text-sm font-medium text-blaster-muted mb-2">Emails ({filtered.filter((r) => r.email).length})</h3>
          <ul className="space-y-1">
            {filtered
              .filter((r) => r.email)
              .slice(0, emailsVisible)
              .map((r) => (
              <li key={`${r.storeUrl}-${r.email}`} className="flex items-center gap-2 text-sm">
                  <span className="text-blaster-fg truncate">{r.email}</span>
                </li>
              ))}
            {filtered.filter((r) => r.email).length > emailsVisible && (
              <li>
                <button
                  type="button"
                  onClick={() => setEmailsVisible((v) => v + INITIAL_VISIBLE)}
                  className="text-blaster-accent hover:underline text-sm"
                >
                  View more ({filtered.filter((r) => r.email).length - emailsVisible} remaining)
                </button>
              </li>
            )}
          </ul>
        </div>
        <div className="rounded-xl p-4 min-h-[320px] overflow-auto bg-blaster-input-bg/50 border border-blaster-border">
          <h3 className="text-sm font-medium text-blaster-muted mb-2">Stores ({totalStores})</h3>
          <ul className="space-y-2">
            {results.slice(0, storesVisible).map((store) => (
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
                  {store.emails?.length ? `${store.emails.length} email(s)` : 'No public email detected'}
                </span>
                {store.sourcePages?.length ? (
                  <span className="text-xs text-blaster-muted block">
                    Source: {store.sourcePages.slice(0, 2).join(', ')}
                  </span>
                ) : null}
              </li>
            ))}
            {results.length > storesVisible && (
              <li>
                <button
                  type="button"
                  onClick={() => setStoresVisible((v) => v + INITIAL_VISIBLE)}
                  className="text-blaster-accent hover:underline text-sm"
                >
                  View more ({results.length - storesVisible} remaining)
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>

      {flatRows.some((r) => !r.hasEmail) && (
        <p className="mt-3 text-sm text-blaster-muted">
          {flatRows.filter((r) => !r.hasEmail).length} store(s) with no public email detected (flagged).
        </p>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-glass p-4 md:p-5 w-full max-w-sm">
            <h3 className="text-xs md:text-sm font-semibold text-blaster-fg mb-2">Export fields</h3>
            <p className="text-xs text-blaster-muted mb-3">
              Choose which columns to include in your Excel export.
            </p>
            <div className="space-y-2 text-sm text-blaster-fg">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exportFields.storeUrl}
                  onChange={(e) =>
                    setExportFields((f) => ({ ...f, storeUrl: e.target.checked }))
                  }
                  className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
                />
                Store link
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exportFields.email}
                  onChange={(e) =>
                    setExportFields((f) => ({ ...f, email: e.target.checked }))
                  }
                  className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
                />
                Email
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-blaster-muted hover:bg-blaster-bg transition"
                onClick={() => setExportOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-blaster-accent text-sm"
                onClick={handleConfirmExport}
                disabled={!exportFields.storeUrl && !exportFields.email}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
