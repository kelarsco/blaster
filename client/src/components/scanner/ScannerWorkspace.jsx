import React from 'react';
import { Link } from 'react-router-dom';
import { Link2 } from 'react-feather';
import { parseUrls } from '../../utils/scannerUrls.js';

export function ScannerWorkspace({
  rawUrls,
  onUrlsChange,
  onStartScan,
  isStarting,
  error,
  upgradeRequired,
  csvName,
}) {
  const urlCount = parseUrls(rawUrls).length;
  const canStart = urlCount >= 1 && !isStarting;

  return (
    <>
      <div className="p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-blaster-fg flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blaster-muted shrink-0" strokeWidth={1.75} aria-hidden />
            Store Links Input
          </h2>
          <p className="text-xs text-blaster-muted mt-0.5">
            {urlCount} valid URL{urlCount !== 1 ? 's' : ''} detected
            {csvName ? ` · ${csvName}` : ''}
          </p>
        </div>
        <textarea
          value={rawUrls}
          onChange={(e) => onUrlsChange(e.target.value)}
          placeholder={'https://store1.com\nhttps://store2.com'}
          rows={8}
          className="w-full min-h-[220px] px-4 py-3 text-sm text-blaster-fg bg-gray-50/80 border border-blaster-border rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-blaster-accent/25 placeholder:text-blaster-muted/60"
          disabled={isStarting}
        />
        <button
          type="button"
          onClick={onStartScan}
          disabled={!canStart}
          className="mt-4 w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStarting ? 'Starting…' : 'Start Scan'}
        </button>
      </div>

      {error ? (
        <div className="px-5 py-3 border-t border-blaster-border bg-amber-500/5 text-sm text-amber-900">
          {error}
          {upgradeRequired ? (
            <Link to="/app/account/pricing" className="mt-2 inline-block font-medium text-blaster-accent hover:underline">
              Upgrade plan →
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
