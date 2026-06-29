import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { API } from '../api.js';
import { parseUrls, computeScanAllowance, MAX_URLS_PER_SCAN } from '../utils/scannerUrls.js';
import { DEFAULT_SCAN_EXTRACT_OPTIONS } from '../utils/scanExtractOptions.js';
import { createEmailList } from '../utils/createEmailList.js';
import { useScanBatches } from '../hooks/useScanBatches.js';
import { FRIENDLY_ERRORS, friendlyHttpError, toFriendlyErrorMessage } from '../utils/friendlyErrors.js';
import { ScannerLanding } from '../components/scanner/ScannerLanding.jsx';
import { ScannerWorkspace } from '../components/scanner/ScannerWorkspace.jsx';
import { ScanBatchFeed } from '../components/scanner/ScanBatchFeed.jsx';

export default function ScannerPage() {
  const { authFetch, user } = useAuth();
  const { requireActivePlan } = usePlanAccess();
  const navigate = useNavigate();
  const { batches, batchCounter, hydrated, addBatch, removeBatch } = useScanBatches(authFetch, user?.id);

  const [phase, setPhase] = useState('landing');
  const [rawUrls, setRawUrls] = useState('');
  const [csvName, setCsvName] = useState('');
  const [extractOptions, setExtractOptions] = useState(DEFAULT_SCAN_EXTRACT_OPTIONS);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [scanLimits, setScanLimits] = useState(null);

  const loadScanLimits = useCallback(async () => {
    if (!authFetch || !user) {
      setScanLimits(null);
      return;
    }
    try {
      const res = await authFetch(`${API}/scan/limits`);
      if (res.ok) {
        setScanLimits(await res.json());
      }
    } catch (_) {}
  }, [authFetch, user]);

  useEffect(() => {
    loadScanLimits();
  }, [loadScanLimits]);

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
    if (!requireActivePlan()) return;
    setError('');
    setUpgradeRequired(false);
    setIsStarting(true);

    try {
      const allUrls = parseUrls(rawUrls);
      if (!allUrls.length) throw new Error('Add at least one valid store URL.');

      const maxPerScan = scanLimits?.maxUrlsPerScan ?? MAX_URLS_PER_SCAN;
      const scansRemaining = scanLimits?.scansRemaining ?? MAX_URLS_PER_SCAN;
      const allowedCount = computeScanAllowance(allUrls.length, { maxPerScan, scansRemaining });
      if (allowedCount < 1) {
        setUpgradeRequired(true);
        setError("You've reached your store scan limit. Upgrade to scan more stores.");
        return;
      }

      const urlsToScan = allUrls.slice(0, allowedCount);

      const res = await authFetch(`${API}/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawUrls: urlsToScan.join('\n'),
          maxUrlsPerScan: maxPerScan,
          extractOptions: { ...extractOptions },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402 || res.status === 403) {
          setUpgradeRequired(true);
          setError(data.error || 'Upgrade required to scan more stores.');
          return;
        }
        throw new Error(friendlyHttpError(res.status, data.error, FRIENDLY_ERRORS.scan));
      }

      if (data.scanId) {
        addBatch({
          scanId: data.scanId,
          totalUrls: data.scannedUrls ?? urlsToScan.length,
          extractOptions: { ...extractOptions },
          label: `Batch ${batchCounter}`,
        });
        setPhase('workspace');
        setRawUrls('');
        setCsvName('');
        loadScanLimits();
      }
    } catch (err) {
      setError(toFriendlyErrorMessage(err, FRIENDLY_ERRORS.scan));
    } finally {
      setIsStarting(false);
    }
  };

  const handleFetchResults = useCallback(
    async (batch) => {
      const res = await authFetch(`${API}/scan/results/${batch.scanId}`);
      if (!res.ok) return batch.results || [];
      const data = await res.json().catch(() => ({}));
      return parseScanResultsPayload(data);
    },
    [authFetch]
  );

  const handleStartCampaign = useCallback(
    async (batch, name) => {
      if (!requireActivePlan()) return;
      const recipients = recipientsFromResults(batch.results);
      if (!recipients.length) throw new Error('No emails to save');

      const list = await createEmailList(authFetch, { name, recipients });
      navigate('/app/campaigns', { state: { highlightListId: list.id } });
    },
    [authFetch, navigate, requireActivePlan]
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
          scanLimits={scanLimits}
        />
        <ScanBatchFeed
          batches={batches}
          onStartCampaign={handleStartCampaign}
          onRemoveBatch={removeBatch}
          onFetchResults={handleFetchResults}
        />
      </div>
    </div>
  );
}
