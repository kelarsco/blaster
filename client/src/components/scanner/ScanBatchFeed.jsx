import React, { useState } from 'react';
import { Check, Download, Radio, X } from 'react-feather';
import { exportScanResultsCsv, formatExtractedSummary, storesWithExtractedData } from '../../utils/scannerUrls.js';
import { CampaignNameModal } from './CampaignNameModal.jsx';
import { ExportFieldsModal } from './ExportFieldsModal.jsx';

function GradientProgress({ processed, total, complete }) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div className="w-full">
      <p className="text-[10px] font-semibold text-blaster-muted text-left mb-1">
        {processed}/{total || 0} links
      </p>
      <div className="relative h-[6px] rounded-full bg-gray-100 overflow-hidden border border-blaster-border/60">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            complete
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : 'bg-gradient-to-r from-blaster-accent to-blaster-orange'
          }`}
          style={{ width: `${complete ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}

function ScanBatchCard({ batch, onStartCampaign, onRemove, onFetchResults }) {
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportError, setExportError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleExport = async (fields) => {
    setExportError('');
    let results = batch.results;
    if ((!results || results.length === 0) && onFetchResults) {
      results = await onFetchResults(batch);
    }
    const rowCount = exportScanResultsCsv(results || [], fields);
    if (!rowCount) {
      setExportError('No valid contact data to export for the selected fields.');
      return;
    }
    setExportOpen(false);
  };

  const isComplete = batch.status === 'completed';
  const isFailed = batch.status === 'failed';
  const hasExportable = storesWithExtractedData(batch.results, batch.extractOptions).length > 0;

  const handleSaveCampaign = async (name) => {
    setSaving(true);
    try {
      await onStartCampaign(batch, name);
      onRemove(batch.id);
    } finally {
      setSaving(false);
      setCampaignOpen(false);
    }
  };

  const summaryText = isComplete && batch.results?.length
    ? formatExtractedSummary(batch.results, batch.extractOptions, batch.foundCount)
    : `${batch.foundCount || 0} store${(batch.foundCount || 0) !== 1 ? 's' : ''} with contacts`;

  return (
    <>
      <article
        className={`px-5 py-4 border-b border-blaster-border last:border-b-0 transition ${
          isComplete ? 'bg-emerald-50/30' : isFailed ? 'bg-red-50/20' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-blaster-fg">{batch.label}</h3>
              {isComplete ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/80">
                  <Check className="w-3 h-3" />
                  Complete
                </span>
              ) : isFailed ? (
                <span className="text-xs font-medium text-red-600">Failed</span>
              ) : (
                <span className="text-xs font-medium bg-gradient-to-r from-blaster-accent to-blaster-orange bg-clip-text text-transparent">
                  Scanning…
                </span>
              )}
            </div>
            <p className="text-xs text-blaster-muted mt-0.5">
              {summaryText}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(batch.id)}
            className="shrink-0 p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition"
            aria-label={`Remove ${batch.label}`}
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className={`flex flex-col sm:flex-row gap-3 ${isComplete ? 'sm:items-center' : ''}`}>
          <div className={isComplete ? 'sm:w-[80%] min-w-0' : 'w-full'}>
            <GradientProgress
              processed={batch.processed || 0}
              total={batch.totalUrls || 0}
              complete={isComplete}
            />
          </div>

          {isComplete && (
            <div className="sm:w-[20%] flex sm:flex-row sm:items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCampaignOpen(true)}
                disabled={!hasExportable || saving}
                className="w-[110px] px-2 py-2 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-xs font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40 whitespace-nowrap"
              >
                Start Campaign
              </button>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                disabled={!hasExportable}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-blaster-border text-blaster-muted hover:text-blaster-fg hover:border-blaster-accent/30 transition disabled:opacity-40"
                aria-label="Download export"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </article>

      {campaignOpen ? (
        <CampaignNameModal
          onClose={() => setCampaignOpen(false)}
          onConfirm={handleSaveCampaign}
          saving={saving}
        />
      ) : null}

      {exportOpen ? (
        <ExportFieldsModal
          extractOptions={batch.extractOptions}
          onClose={() => {
            setExportOpen(false);
            setExportError('');
          }}
          onConfirm={handleExport}
          error={exportError}
        />
      ) : null}
    </>
  );
}

export function ScanBatchFeed({ batches, onStartCampaign, onRemoveBatch, onFetchResults }) {
  return (
    <div className="border-t border-blaster-border">
      <div className="px-5 py-4 border-b border-blaster-border">
        <h2 className="text-sm font-semibold text-blaster-fg">Scan Results Feed</h2>
        <p className="text-xs text-blaster-muted mt-0.5">Live progress for each scan batch</p>
      </div>

      {batches.length === 0 ? (
        <div className="py-12 text-center px-5">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blaster-accent/10 to-blaster-orange/20 mb-3 mx-auto" aria-hidden>
            <Radio className="w-6 h-6 text-blaster-muted" strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-blaster-fg">No scans yet</p>
        </div>
      ) : (
        batches.map((batch) => (
          <ScanBatchCard
            key={batch.id}
            batch={batch}
            onStartCampaign={onStartCampaign}
            onRemove={onRemoveBatch}
            onFetchResults={onFetchResults}
          />
        ))
      )}
    </div>
  );
}
