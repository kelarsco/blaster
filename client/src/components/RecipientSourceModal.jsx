import React, { useState, useCallback, useRef } from 'react';
import { Upload } from 'react-feather';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TILE_BASE =
  'group relative flex flex-col items-center justify-center aspect-square w-[148px] sm:w-[156px] rounded-2xl border bg-white shadow-sm hover:shadow-md hover:border-blaster-accent/35 hover:-translate-y-0.5 transition-all duration-300 p-4';

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

function SavedListTile({ list, selected, onClick }) {
  const count = list.recipients?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${TILE_BASE} ${
        selected
          ? 'border-blaster-accent ring-2 ring-blaster-accent/30'
          : 'border-blaster-border'
      }`}
    >
      <span className="absolute top-2.5 right-2.5 min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 border border-blaster-accent/20 text-[10px] font-semibold text-blaster-fg">
        {count}
      </span>
      <span className="text-sm font-semibold text-blaster-fg text-center line-clamp-3 leading-snug px-1">
        {list.name}
      </span>
      <span className="text-[10px] text-blaster-muted mt-1">contacts</span>
    </button>
  );
}

function CsvUploadTile({ onFileChange, count }) {
  const fileRef = useRef(null);

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`${TILE_BASE} border-dashed border-blaster-border cursor-pointer`}
      >
        {count > 0 && (
          <span className="absolute top-2.5 right-2.5 min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 border border-blaster-accent/20 text-[10px] font-semibold text-blaster-fg">
            {count}
          </span>
        )}
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 group-hover:from-blaster-accent/25 group-hover:to-blaster-orange/35 transition">
          <Upload className="w-6 h-6 text-blaster-accent" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-semibold text-blaster-fg text-center mt-2">Upload CSV</span>
        <span className="text-[10px] text-blaster-muted mt-1">{count > 0 ? 'contacts' : 'Import a file'}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
        className="hidden"
      />
    </>
  );
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
    e.target.value = '';
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

          <div className="flex flex-wrap gap-4">
            {emailLists.length > 0 && onContinueSavedLists
              ? emailLists.map((list) => (
                  <SavedListTile
                    key={list.id}
                    list={list}
                    selected={selectedListIds.has(list.id)}
                    onClick={() => toggleSavedList(list.id)}
                  />
                ))
              : null}
            {onContinueCsv ? (
              <CsvUploadTile onFileChange={onFileChange} count={csvRecipients.length} />
            ) : null}
          </div>

          {emailLists.length === 0 && onContinueSavedLists && (
            <p className="text-sm text-blaster-muted">No saved lists yet. Upload a CSV or save a list from the Scanner page.</p>
          )}

          {csvError && <p className="text-xs text-red-600">{csvError}</p>}

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

          {csvRecipients.length > 0 && onContinueCsv && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onContinueCsv(csvRecipients)}
                className="btn-blaster-accent text-sm"
              >
                Continue with {csvRecipients.length} email{csvRecipients.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
