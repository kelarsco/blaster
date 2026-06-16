const STORAGE_PREFIX = 'wiblaster-scan-batches';

function storageKey(userId) {
  return userId ? `${STORAGE_PREFIX}-${userId}` : STORAGE_PREFIX;
}

function sanitizeBatch(batch) {
  if (!batch?.scanId) return null;
  return {
    id: batch.id || batch.scanId,
    scanId: batch.scanId,
    label: batch.label || 'Batch',
    status: batch.status || 'pending',
    processed: Number(batch.processed) || 0,
    totalUrls: Number(batch.totalUrls) || 0,
    foundCount: Number(batch.foundCount) || 0,
    extractOptions: batch.extractOptions || { email: true },
    startedAt: batch.startedAt || Date.now(),
  };
}

export function loadScanBatchState(userId) {
  if (typeof window === 'undefined' || !userId) {
    return { batches: [], batchCounter: 1 };
  }
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { batches: [], batchCounter: 1 };
    const parsed = JSON.parse(raw);
    const batches = (Array.isArray(parsed.batches) ? parsed.batches : [])
      .map(sanitizeBatch)
      .filter(Boolean);
    const batchCounter = Math.max(
      1,
      Number(parsed.batchCounter) || batches.length + 1
    );
    return { batches, batchCounter };
  } catch {
    return { batches: [], batchCounter: 1 };
  }
}

export function saveScanBatchState(userId, { batches, batchCounter }) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const payload = {
      batches: (batches || []).map(sanitizeBatch).filter(Boolean),
      batchCounter: Math.max(1, Number(batchCounter) || 1),
    };
    localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch (_) {}
}

export function clearScanBatchState(userId) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch (_) {}
}
