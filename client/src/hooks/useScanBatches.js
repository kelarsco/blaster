import { useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../api.js';
import { mapScanStatus, parseScanResultsPayload } from '../utils/scanStatus.js';
import {
  loadScanBatchState,
  saveScanBatchState,
  clearScanBatchState,
} from '../utils/scanBatchStorage.js';
import { setScanBadgePending } from '../utils/scanBadge.js';

const ACTIVE_STATUSES = new Set(['pending', 'running', 'processing']);

async function refreshBatchFromApi(authFetch, batch) {
  const statusRes = await authFetch(`${API}/scan/status/${batch.scanId}`);
  if (statusRes.status === 404) {
    return { ...batch, status: 'failed', scanMissing: true };
  }
  if (!statusRes.ok) return batch;

  const statusData = await statusRes.json();
  const mapped = mapScanStatus(statusData);
  const isDone = mapped.status === 'completed' || mapped.status === 'failed';

  const next = {
    ...batch,
    status: mapped.status,
    processed: mapped.processed,
    totalUrls: mapped.totalUrls,
    foundCount: mapped.foundCount,
  };

  const isActive = ACTIVE_STATUSES.has(mapped.status);
  if (isDone || (isActive && mapped.processed > 0)) {
    try {
      const resultsRes = await authFetch(`${API}/scan/results/${batch.scanId}`);
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        next.results = parseScanResultsPayload(resultsData);
      }
    } catch (_) {}
  }

  return next;
}

export function useScanBatches(authFetch, userId) {
  const [batches, setBatches] = useState([]);
  const [batchCounter, setBatchCounter] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const batchesRef = useRef(batches);
  const prevUserIdRef = useRef(userId);
  batchesRef.current = batches;

  useEffect(() => {
    if (!userId) {
      setBatches([]);
      setBatchCounter(1);
      setHydrated(false);
      return undefined;
    }

    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      clearScanBatchState(prevUserIdRef.current);
    }
    prevUserIdRef.current = userId;

    let cancelled = false;
    const stored = loadScanBatchState(userId);
    setBatchCounter(stored.batchCounter);

    (async () => {
      if (!authFetch || stored.batches.length === 0) {
        if (!cancelled) {
          setBatches(stored.batches);
          setHydrated(true);
        }
        return;
      }

      const refreshed = await Promise.all(
        stored.batches.map((batch) => refreshBatchFromApi(authFetch, batch).catch(() => batch))
      );
      if (!cancelled) {
        setBatches(refreshed.filter((b) => !b.scanMissing));
        setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authFetch]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    saveScanBatchState(userId, { batches, batchCounter });
  }, [batches, batchCounter, hydrated, userId]);

  const updateBatch = useCallback((batchId, patch) => {
    setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, ...patch } : b)));
  }, []);

  const removeBatch = useCallback((batchId) => {
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
  }, []);

  const addBatch = useCallback(({ scanId, totalUrls, extractOptions, label }) => {
    const batch = {
      id: scanId,
      scanId,
      label: label || `Batch ${batchesRef.current.length + 1}`,
      status: 'pending',
      processed: 0,
      totalUrls: totalUrls || 0,
      foundCount: 0,
      results: [],
      extractOptions,
      startedAt: Date.now(),
    };
    setBatches((prev) => [batch, ...prev]);
    setBatchCounter((n) => n + 1);
    return batch;
  }, []);

  useEffect(() => {
    if (!authFetch || !hydrated) return undefined;

    let cancelled = false;
    const poll = async () => {
      const active = batchesRef.current.filter((b) => ACTIVE_STATUSES.has(b.status));
      if (!active.length) return;

      await Promise.all(
        active.map(async (batch) => {
          try {
            const updated = await refreshBatchFromApi(authFetch, batch);
            if (updated.scanMissing) {
              removeBatch(batch.id);
              return;
            }
            const wasActive = ACTIVE_STATUSES.has(batch.status);
            const nowComplete = updated.status === 'completed';
            if (wasActive && nowComplete && typeof window !== 'undefined') {
              const onScanner = window.location.pathname.startsWith('/app/scanner');
              if (!onScanner) setScanBadgePending();
            }
            updateBatch(batch.id, {
              status: updated.status,
              processed: updated.processed,
              totalUrls: updated.totalUrls,
              foundCount: updated.foundCount,
              results: updated.results,
            });
          } catch (_) {}
        })
      );
    };

    poll();
    const interval = setInterval(() => {
      if (!cancelled) poll();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authFetch, updateBatch, removeBatch, hydrated, batches.length]);

  return {
    batches,
    batchCounter,
    hydrated,
    addBatch,
    updateBatch,
    removeBatch,
  };
}
