import React, { useRef } from 'react';
import { Clipboard, Upload } from 'react-feather';

const CARD =
  'group relative flex flex-col items-center justify-center gap-4 aspect-square w-full max-w-[280px] rounded-2xl border border-blaster-border bg-white shadow-sm hover:shadow-md transition-all duration-300 hover:border-blaster-accent/40 hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blaster-accent/30';

export function ScannerLanding({ onManual, onCsvSelected }) {
  const fileRef = useRef(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] py-8 animate-[fadeIn_0.35s_ease-out]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 w-full max-w-2xl px-2 justify-items-center">
        <button type="button" onClick={onManual} className={CARD}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 group-hover:from-blaster-accent/25 group-hover:to-blaster-orange/35 transition">
            <Clipboard className="w-8 h-8 text-blaster-muted group-hover:text-blaster-accent/75 transition-colors" strokeWidth={1.75} />
          </span>
          <div className="text-center px-4">
            <p className="text-base font-semibold text-blaster-fg">My Store List</p>
            <p className="text-sm text-blaster-muted mt-1">Paste links manually</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={CARD}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 group-hover:from-blaster-accent/25 group-hover:to-blaster-orange/35 transition">
            <Upload className="w-8 h-8 text-blaster-muted group-hover:text-blaster-accent/75 transition-colors" strokeWidth={1.75} />
          </span>
          <div className="text-center px-4">
            <p className="text-base font-semibold text-blaster-fg">Upload CSV</p>
            <p className="text-sm text-blaster-muted mt-1">Import a file</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onCsvSelected(file);
              e.target.value = '';
            }}
          />
        </button>
      </div>
    </div>
  );
}
