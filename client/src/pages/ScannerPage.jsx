import React from 'react';
import { UrlInput } from '../components/UrlInput';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { useToolState } from '../context/ToolStateContext';
import { API } from '../api.js';

export function ScannerPage() {
  const {
    scanId,
    setScanId,
    scanStatus,
    setScanStatus,
    results,
    setResults,
    setAutomationOpen,
  } = useToolState();

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blaster-fg">Store Scanner</h1>
        <p className="text-blaster-muted mt-0.5">Extract contact emails from store privacy and contact pages</p>
      </div>
      <div className="space-y-6">
        <UrlInput
          onScanStart={(id) => {
            setScanId(id);
            setScanStatus({ scanId: id, status: 'running', processed: 0, totalUrls: 0, foundCount: 0 });
          }}
          onScanStatus={setScanStatus}
          scanId={scanId}
          existingResults={results}
          existingScanId={scanId}
        />
        {scanId && (
          <ResultsDashboard
            scanId={scanId}
            scanStatus={scanStatus}
            results={results}
            onResults={setResults}
            onExportXml={() => window.open(`${API}/export/xml/${scanId}`, '_blank')}
            onStartAutomation={() => setAutomationOpen(true)}
            onClearResults={() => {
              setScanId(null);
              setResults([]);
              setScanStatus(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
