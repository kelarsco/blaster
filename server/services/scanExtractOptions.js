/** Default fields extracted on every store scan (EcomScout-style full contact pull). */
export const DEFAULT_SCAN_EXTRACT_OPTIONS = {
  email: true,
  phone: true,
  whatsapp: true,
  instagram: true,
  tiktok: true,
};

export function normalizeExtractOptions(input) {
  const base = { ...DEFAULT_SCAN_EXTRACT_OPTIONS };
  if (!input || typeof input !== 'object') return base;
  for (const key of Object.keys(base)) {
    if (typeof input[key] === 'boolean') base[key] = input[key];
  }
  return base;
}
