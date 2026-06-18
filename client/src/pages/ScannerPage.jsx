import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../api.js';
import { parseUrls, recipientsFromResults } from '../utils/scannerUrls.js';
import { useScanBatches } from '../hooks/useScanBatches.js';
import { ScannerLanding } from '../components/scanner/ScannerLanding.jsx';
import { ScannerWorkspace, DEFAULT_EXTRACT_OPTIONS } from '../components/scanner/ScannerWorkspace.jsx';
import { ScanBatchFeed } from '../components/scanner/ScanBatchFeed.jsx';

export default function ScannerPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const { batches, batchCounter, hydrated, addBatch, removeBatch } = useScanBatches(authFetch, user?.id);

  const [phase, setPhase] = useState('landing');
  const [rawUrls, setRawUrls] = useState('');
  const [csvName, setCsvName] = useState('');
  const [extractOptions, setExtractOptions] = useState(DEFAULT_EXTRACT_OPTIONS);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  useEffect(() => {
    if (hydrated && batches.length > 0) {
      setPhase('workspace');
    }
  }, [hydrated, batches.length]);

  const handleCsvFile = async (file) => {
    try {
      const text = await file.text();
      const cells = text.split(/[\n,\r\t;]+/).map((item) => item.trim()).filter(Boolean);
      const merged = cells.join('\n');
      setRawUrls(parseUrls(merged).join('\n'));
      setCsvName(file.name);
      setPhase('workspace');
      setError('');
    } catch {
      setError('Failed to read CSV file.');
    }
  };

  const toggleExtract = (key) => {
    setExtractOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startScan = async () => {
    if (isStarting) return;
    setError('');
    setUpgradeRequired(false);
    setIsStarting(true);

    try {
      const maxConcurrentCrawlers = 10;
      const maxUrlsPerScan = 1000;

      const urls = parseUrls(rawUrls);
      if (!urls.length) throw new Error('Add at least one valid store URL.');

      const res = await authFetch(`${API}/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawUrls: urls.join('\n'),
          maxConcurrentCrawlers,
          maxUrlsPerScan,
          extractOptions: { ...extractOptions },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402) {
          setUpgradeRequired(true);
          return;
        }
        throw new Error(data.error || `Failed to start scan (${res.status})`);
      }

      if (data.scanId) {
        addBatch({
          scanId: data.scanId,
          totalUrls: data.scannedUrls ?? urls.length,
          extractOptions: { ...extractOptions },
          label: `Batch ${batchCounter}`,
        });
        setPhase('workspace');
        setRawUrls('');
        setCsvName('');
      }
    } catch (err) {
      setError(err?.message || 'Failed to start scan');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartCampaign = useCallback(
    async (batch, name) => {
      const recipients = recipientsFromResults(batch.results);
      if (!recipients.length) throw new Error('No contacts to save');

      const res = await authFetch(`${API}/email-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, recipients }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save campaign');

      navigate('/app/campaigns', { state: { highlightListId: data.list?.id } });
    },
    [authFetch, navigate]
  );

  if (!hydrated) {
    return <div className="min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8" />;
  }

  if (phase === 'landing' && batches.length === 0) {
    return (
      <div className="min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
        <ScannerLanding
          onManual={() => {
            setPhase('workspace');
            setError('');
          }}
          onCsvSelected={handleCsvFile}
        />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden shadow-sm animate-[fadeIn_0.3s_ease-out]">
        <ScannerWorkspace
          rawUrls={rawUrls}
          onUrlsChange={setRawUrls}
          extractOptions={extractOptions}
          onToggleExtract={toggleExtract}
          onStartScan={startScan}
          isStarting={isStarting}
          error={error}
          upgradeRequired={upgradeRequired}
          csvName={csvName}
        />
        <ScanBatchFeed
          batches={batches}
          onStartCampaign={handleStartCampaign}
          onRemoveBatch={removeBatch}
        />
      </div>
    </div>
  );
}
