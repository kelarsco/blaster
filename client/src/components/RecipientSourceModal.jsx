import React, { useState, useCallback } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((c) => c.trim().toLowerCase().replace(/\s+/g, '_'));
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail');
  const urlIdx = header.findIndex((h) => h === 'store_url' || h === 'storeurl' || h === 'url');
  const useFirstAsEmail = emailIdx === -1;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const email = useFirstAsEmail ? (cells[0] || '').trim() : (cells[emailIdx] || '').trim();
    const storeUrl = (urlIdx >= 0 && cells[urlIdx]) ? cells[urlIdx].trim() : '';
    if (email && EMAIL_REGEX.test(email)) {
      rows.push({ email, storeUrl: storeUrl || email });
    }
  }
  return rows;
}

export function RecipientSourceModal({ onClose, onContinueScanned, onContinueCsv, onContinueSavedLists, scannedCount, emailLists = [] }) {
  const [csvRecipients, setCsvRecipients] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [selectedListIds, setSelectedListIds] = useState(new Set());

  const toggleSavedList = useCallback((id) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const savedListsRecipients = selectedListIds.size > 0
    ? (() => {
        const combined = emailLists
          .filter((l) => selectedListIds.has(l.id))
          .flatMap((l) => l.recipients || []);
        const byEmail = new Map();
        for (const r of combined) {
          if (r.email && !byEmail.has(r.email.toLowerCase())) byEmail.set(r.email.toLowerCase(), r);
        }
        return [...byEmail.values()];
      })()
    : [];

  const onFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    setCsvError('');
    setCsvRecipients([]);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result || '';
        const rows = parseCsv(text);
        setCsvRecipients(rows);
        if (rows.length === 0) setCsvError('No valid email addresses found in the CSV. Ensure the file has an "email" column or that the first column contains emails.');
      } catch {
        setCsvError('Could not parse CSV.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header-mobile flex items-center justify-between shrink-0">
          <h2 className="card-title-mobile">Choose email list</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-border/50">
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-blaster-muted">Select one or more saved lists to run the campaign for.</p>

          {emailLists.length > 0 && onContinueSavedLists ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {emailLists.map((list) => {
                  const count = list.recipients?.length ?? 0;
                  const selected = selectedListIds.has(list.id);
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => toggleSavedList(list.id)}
                      className={`rounded-xl border p-4 text-left transition min-h-[80px] flex flex-col justify-between ${
                        selected
                          ? 'border-blaster-accent bg-blaster-accent/10 text-blaster-fg ring-2 ring-blaster-accent/30'
                          : 'border-blaster-border bg-blaster-bg hover:bg-blaster-bg-app text-blaster-fg'
                      }`}
                    >
                      <span className="font-medium text-sm truncate block" title={list.name}>{list.name}</span>
                      <span className="text-lg font-semibold text-blaster-accent">{count}</span>
                      <span className="text-xs text-blaster-muted">emails</span>
                    </button>
                  );
                })}
              </div>
              {selectedListIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-sm text-blaster-muted">{savedListsRecipients.length} email{savedListsRecipients.length !== 1 ? 's' : ''} selected</span>
                  <button
                    type="button"
                    onClick={() => onContinueSavedLists(savedListsRecipients)}
                    className="btn-blaster-accent text-sm"
                  >
                    Continue with {savedListsRecipients.length} emails
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-blaster-muted">No saved lists yet. Save a list from the Email lists section above, or use an option below.</p>
          )}

          <div className="border-t border-blaster-border pt-4 space-y-3">
            <p className="text-xs font-medium text-blaster-muted uppercase tracking-wide">Other options</p>
            <button
              type="button"
              onClick={onContinueScanned}
              disabled={scannedCount === 0}
              className="w-full flex items-center justify-between rounded-xl border border-blaster-border bg-blaster-bg p-3 text-left hover:bg-blaster-bg-app transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              <span className="font-medium text-blaster-fg">From scanned stores</span>
              <span className="text-blaster-muted">
                {scannedCount > 0 ? `${scannedCount} emails` : 'Run a scan first'}
              </span>
            </button>
            <div className="rounded-xl border border-blaster-border bg-blaster-bg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-blaster-fg text-sm">Upload CSV</span>
                {csvRecipients.length > 0 && <span className="text-xs text-blaster-muted">{csvRecipients.length} emails</span>}
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="block w-full text-xs text-blaster-muted file:mr-2 file:py-1.5 file:px-2 file:rounded file:border-0 file:bg-blaster-accent file:text-white"
              />
              {csvError && <p className="text-xs text-red-600">{csvError}</p>}
              <button
                type="button"
                onClick={() => onContinueCsv(csvRecipients)}
                disabled={csvRecipients.length === 0}
                className="btn-blaster-accent text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue with {csvRecipients.length || 0} emails
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
