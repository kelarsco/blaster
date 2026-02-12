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
        rows.push({
          storeUrl: store.storeUrl,
          email: null,
          sourcePage: store.status || null,
          hasEmail: false,
        });
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
  const canExport = !!scanId && flatRows.some((r) => r.email);

  const IconDownload = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
    </svg>
  );
  const IconPlay = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
  const IconTrash = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12h8l1-12" />
    </svg>
  );

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
    <section className="bg-white rounded-2xl border border-[#e7e8f0] shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6d7385] flex items-center gap-2">
          <span>Results</span>
          {scanStatus ? (
            <span className="text-xs font-medium normal-case tracking-normal text-[#8b92a7]">
              {scanStatus.processed ?? 0}/{scanStatus.totalUrls ?? 0}
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={!canExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#dfe3ee] text-[#667089] hover:bg-[#f3f5fc] text-sm transition disabled:opacity-50"
          >
            <IconDownload />
            Export
          </button>
          <button
            type="button"
            onClick={onStartAutomation}
            disabled={!canStartAutomation}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5561ff] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#4956f2] transition"
          >
            <IconPlay />
            Automate
          </button>
          {onClearResults && (
            <button type="button" onClick={onClearResults} className="inline-flex items-center justify-center px-2.5 py-2 rounded-xl border border-[#dfe3ee] text-[#667089] hover:bg-[#f3f5fc] text-sm transition">
              <IconTrash />
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter emails or stores..."
          className="w-full px-4 py-2.5 rounded-xl bg-[#f6f7fb] border border-[#e4e7f0] text-[#222] placeholder-[#98a0b4] focus:outline-none focus:ring-2 focus:ring-[#6b6ee8]/30 focus:border-[#6b6ee8] transition"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 min-h-[260px] bg-[#fafbff] border border-[#e4e7f0]">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6d7385] mb-2 flex items-center justify-between">
            <span>Emails</span>
            <span>{filtered.filter((r) => r.email).length}</span>
          </h3>
          <ul className="space-y-1">
            {filtered.filter((r) => r.email).length === 0 ? (
              <li className="h-[185px] flex items-center justify-center text-[#b0b6c6] text-xl">No emails found yet</li>
            ) : (
              filtered
                .filter((r) => r.email)
                .slice(0, emailsVisible)
                .map((r) => (
                  <li key={`${r.storeUrl}-${r.email}`} className="flex items-center gap-2 text-sm">
                    <span className="text-[#2a2d38] truncate">{r.email}</span>
                  </li>
                ))
            )}
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
        <div className="rounded-2xl p-4 min-h-[260px] bg-[#fafbff] border border-[#e4e7f0]">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6d7385] mb-2 flex items-center justify-between">
            <span>Stores</span>
            <span>{totalStores}</span>
          </h3>
          <ul className="space-y-2">
            {results.length === 0 ? (
              <li className="h-[185px] flex items-center justify-center text-[#b0b6c6] text-xl">No stores scanned yet</li>
            ) : (
              results.slice(0, storesVisible).map((store) => (
                <li key={store.storeUrl} className="text-sm">
                  <a
                    href={store.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6366f1] hover:underline truncate block"
                  >
                    {store.storeUrl}
                  </a>
                  <span className="text-[#8b92a7]">
                    {store.emails?.length ? `${store.emails.length} email(s)` : (store.status || 'No Email Found')}
                  </span>
                  {store.sourcePages?.length ? (
                    <span className="text-xs text-[#a0a7bb] block">
                      Source: {store.sourcePages.slice(0, 2).join(', ')}
                    </span>
                  ) : null}
                </li>
              ))
            )}
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
        <p className="mt-3 text-sm text-[#8b92a7]">
          {flatRows.filter((r) => !r.hasEmail).length} store(s) with no email found (flagged).
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
