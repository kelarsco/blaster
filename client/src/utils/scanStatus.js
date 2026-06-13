/** Normalize scan status payloads from GET /api/scan/status/:id */
export function mapScanStatus(data) {
  if (!data) return null;
  const id = data.scanId ?? data.id;
  return {
    scanId: id,
    id,
    status: data.status ?? 'unknown',
    processed: Number(data.processed ?? 0),
    totalUrls: Number(data.totalUrls ?? data.total_urls ?? 0),
    foundCount: Number(data.foundCount ?? data.found_count ?? 0),
    createdAt: data.createdAt ?? data.created_at ?? null,
  };
}

export function parseScanResultsPayload(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}
