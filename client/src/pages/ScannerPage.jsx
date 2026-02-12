import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f5f6fb] min-h-full">
      <div className="mb-4 md:mb-6">
        <h1 className="page-title-mobile">Scanner</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Fetch store pages and extract contact emails</p>
      </div>
      <div className="space-y-4 md:space-y-6">
        <UrlInput
          onScanStart={(id) => {
            setScanId(id);
            setScanStatus({ scanId: id, status: 'running', processed: 0, totalUrls: 0, foundCount: 0 });
          }}
          onScanStatus={setScanStatus}
          scanId={scanId}
          scanStatus={scanStatus}
          existingResults={results}
          existingScanId={scanId}
        />
        {scanId && (
          <ResultsDashboard
            scanId={scanId}
            scanStatus={scanStatus}
            results={results}
            onResults={setResults}
            onExportExcel={(fields) => {
              if (!scanId) return;
              const params = new URLSearchParams();
              if (fields && fields.length) params.set('fields', fields.join(','));
              const qs = params.toString();
              const url = `${API}/export/excel/${scanId}${qs ? `?${qs}` : ''}`;
              window.open(url, '_blank');
            }}
            onStartAutomation={() => {
              navigate('/app/campaigns');
              setAutomationOpen(true);
            }}
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
