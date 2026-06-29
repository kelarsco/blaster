import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Mail, MessageCircle, Camera, Music } from 'react-feather';
import { parseUrls, computeScanAllowance, MAX_URLS_PER_SCAN } from '../../utils/scannerUrls.js';

const EXTRACT_OPTIONS = [
  { key: 'email', label: 'Email', Icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { key: 'instagram', label: 'Instagram', Icon: Camera },
  { key: 'tiktok', label: 'TikTok', Icon: Music },
];

export function ScannerWorkspace({
  rawUrls,
  onUrlsChange,
  extractOptions,
  onToggleExtract,
  onStartScan,
  isStarting,
  error,
  upgradeRequired,
  csvName,
  scanLimits,
}) {
  const allUrls = useMemo(() => parseUrls(rawUrls), [rawUrls]);
  const urlCount = allUrls.length;

  const maxPerScan = scanLimits?.maxUrlsPerScan ?? MAX_URLS_PER_SCAN;
  const scansRemaining = scanLimits?.scansRemaining ?? MAX_URLS_PER_SCAN;
  const scansWindowHours = scanLimits?.scansWindowHours ?? null;

  const scanAllowed = computeScanAllowance(urlCount, { maxPerScan, scansRemaining });
  const excessCount = scanAllowed < urlCount ? urlCount - scanAllowed : 0;

  const hasAnyExtract = Object.values(extractOptions).some(Boolean);
  const canStart = scanAllowed >= 1 && hasAnyExtract && !isStarting;

  const quotaNote =
    scansWindowHours && scanLimits?.signupTrialActive
      ? `${scansRemaining} of ${scanLimits.scansLimit} scans left in your ${scansWindowHours}-hour window`
      : scansRemaining < 999999
        ? `${scansRemaining} scan${scansRemaining !== 1 ? 's' : ''} remaining on your plan`
        : null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] divide-y lg:divide-y-0 lg:divide-x divide-blaster-border">
        <div className="flex flex-col min-h-[280px]">
          <div className="px-5 py-4 border-b border-blaster-border lg:border-b-0">
            <h2 className="text-sm font-semibold text-blaster-fg flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blaster-muted shrink-0" strokeWidth={1.75} aria-hidden />
              Store Links Input
            </h2>
            <p className="text-xs text-blaster-muted mt-0.5">
              {urlCount} valid URL{urlCount !== 1 ? 's' : ''} detected
              {urlCount > 0 && scanAllowed < urlCount
                ? ` · ${scanAllowed} will be scanned`
                : urlCount > maxPerScan
                  ? ` · max ${maxPerScan} per scan`
                  : ''}
              {csvName ? ` · ${csvName}` : ''}
            </p>
            {quotaNote ? <p className="text-xs text-blaster-muted mt-1">{quotaNote}</p> : null}
          </div>
          <textarea
            value={rawUrls}
            onChange={(e) => onUrlsChange(e.target.value)}
            placeholder={'https://store1.com\nhttps://store2.com'}
            className="flex-1 min-h-[220px] w-full px-5 py-4 text-sm text-blaster-fg bg-transparent resize-none focus:outline-none placeholder:text-blaster-muted/60"
            disabled={isStarting}
          />
          {excessCount > 0 ? (
            <p className="px-5 py-2 text-xs text-blaster-muted border-t border-blaster-border">
              {urlCount} links pasted — only {scanAllowed} will be scanned
              {scansWindowHours && scanLimits?.scansLimit
                ? ` (${scanLimits.scansLimit} per ${scansWindowHours}h)`
                : ` (max ${maxPerScan} per scan)`}.
            </p>
          ) : null}
        </div>

        <div className="p-5 flex flex-col min-h-[280px]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-blaster-muted mb-3">
            Extract options
          </h2>
          <div className="flex flex-col gap-2 flex-1">
            {EXTRACT_OPTIONS.map((opt) => {
              const active = extractOptions[opt.key];
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onToggleExtract(opt.key)}
                  disabled={isStarting}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition text-left disabled:opacity-50 ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 text-blaster-fg shadow-sm'
                      : 'border-blaster-border bg-gray-50/80 text-blaster-muted hover:border-blaster-accent/25 hover:text-blaster-fg'
                  }`}
                >
                  <Icon
                    className="w-4 h-4 shrink-0 text-blaster-muted"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onStartScan}
            disabled={!canStart}
            className="mt-5 w-full inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStarting
              ? 'Starting…'
              : scanAllowed > 0 && scanAllowed < urlCount
                ? `Start Scan (${scanAllowed} stores)`
                : 'Start Scan'}
          </button>
        </div>
      </div>

      {scanAllowed === 0 && urlCount > 0 ? (
        <div className="px-5 py-3 border-t border-blaster-border bg-amber-500/5 text-sm text-amber-900">
          You&apos;ve used all store scans for your {scansWindowHours ? `${scansWindowHours}-hour` : 'current'} limit.
          <Link to="/app/account/pricing" className="ml-1 font-medium text-blaster-accent hover:underline">
            Upgrade to scan more →
          </Link>
        </div>
      ) : null}

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
