import React, { useCallback, useRef, useState } from 'react';
import { Upload, Search, Mail } from 'react-feather';
import { useNavigate } from 'react-router-dom';
import { parseRecipientCsv } from '../utils/parseRecipientCsv.js';

const TILE_BASE =
  'group relative flex flex-col items-center justify-center aspect-square w-[148px] sm:w-[156px] rounded-2xl border bg-white shadow-sm hover:shadow-md hover:border-blaster-accent/35 hover:-translate-y-0.5 transition-all duration-300 p-4';

function SavedListTile({ list, onClick }) {
  const count = list.recipients?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${TILE_BASE} border-blaster-border`}
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

function CsvUploadTile({ onFileChange }) {
  const fileRef = useRef(null);

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`${TILE_BASE} border-dashed border-blaster-border cursor-pointer`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 group-hover:from-blaster-accent/25 group-hover:to-blaster-orange/35 transition">
          <Upload className="w-6 h-6 text-blaster-accent" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-semibold text-blaster-fg text-center mt-2">Upload CSV</span>
        <span className="text-[10px] text-blaster-muted mt-1">Import a file</span>
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

function ScannerTile({ onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${TILE_BASE} border-blaster-border`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 group-hover:from-blaster-accent/25 group-hover:to-blaster-orange/35 transition">
        <Search className="w-6 h-6 text-blaster-accent" strokeWidth={1.75} />
      </span>
      <span className="text-sm font-semibold text-blaster-fg text-center mt-2">App Scanner</span>
      <span className="text-[10px] text-blaster-muted mt-1">Scan store URLs</span>
    </button>
  );
}

function CustomEmailTile({ onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${TILE_BASE} border-blaster-border`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 group-hover:from-blaster-accent/25 group-hover:to-blaster-orange/35 transition">
        <Mail className="w-6 h-6 text-blaster-accent" strokeWidth={1.75} />
      </span>
      <span className="text-sm font-semibold text-blaster-fg text-center mt-2">Custom Email</span>
      <span className="text-[10px] text-blaster-muted mt-1">Single recipient</span>
    </button>
  );
}

export function RecipientSourceModal({
  onClose,
  onOpenList,
  onCsvReady,
  emailLists = [],
}) {
  const navigate = useNavigate();
  const [csvError, setCsvError] = useState('');
  const [customEmailOpen, setCustomEmailOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customEmailError, setCustomEmailError] = useState('');

  const onFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      setCsvError('');
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result || '';
          const rows = parseRecipientCsv(text);
          if (rows.length === 0) {
            setCsvError(
              'No valid email addresses found. Use columns for store URL and email (link first, email second), or an "email" column header.'
            );
            return;
          }
          onCsvReady?.(rows);
        } catch {
          setCsvError('Could not parse CSV.');
        }
      };
      reader.readAsText(file, 'UTF-8');
      e.target.value = '';
    },
    [onCsvReady]
  );

  const handleCustomEmailSubmit = () => {
    const email = customEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCustomEmailError('Please enter a valid email address');
      return;
    }
    setCustomEmailError('');
    setCustomEmailOpen(false);
    onCsvReady?.([{ email, storeUrl: '' }]);
    setCustomEmail('');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="card-header-mobile flex items-center justify-between shrink-0">
            <h2 className="card-title-mobile">New campaign</h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-border/50">
              ×
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <p className="text-sm text-blaster-muted">
              Open a saved list, upload a CSV, or scan stores — all use the same campaign setup.
            </p>

            <div className="flex flex-wrap gap-4">
              <ScannerTile
                onClick={() => {
                  onClose();
                  navigate('/app/scanner');
                }}
              />
              <CsvUploadTile onFileChange={onFileChange} />
              <CustomEmailTile onClick={() => setCustomEmailOpen(true)} />
              {emailLists.map((list) => (
                <SavedListTile
                  key={list.id}
                  list={list}
                  onClick={() => onOpenList?.(list)}
                />
              ))}
            </div>

            {emailLists.length === 0 && (
              <p className="text-sm text-blaster-muted">No saved lists yet. Upload a CSV or scan stores on the Scanner page.</p>
            )}

            {csvError && <p className="text-xs text-red-600">{csvError}</p>}
          </div>
        </div>
      </div>

      {customEmailOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-blaster-border shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-blaster-fg mb-4">Add Custom Recipient</h3>
            <input
              type="email"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-4 py-2 rounded-lg border border-blaster-border focus:border-blaster-accent focus:outline-none"
            />
            {customEmailError && <p className="text-xs text-red-600 mt-2">{customEmailError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setCustomEmailOpen(false);
                  setCustomEmailError('');
                  setCustomEmail('');
                }}
                className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomEmailSubmit}
                className="px-4 py-2 rounded-lg bg-black text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
