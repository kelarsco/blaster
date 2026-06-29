/** Default: email only — socials are opt-in per scan. */
export const DEFAULT_SCAN_EXTRACT_OPTIONS = {
  email: true,
  phone: false,
  whatsapp: false,
  instagram: false,
  tiktok: false,
};

export function normalizeExtractOptions(input) {
  const base = { ...DEFAULT_SCAN_EXTRACT_OPTIONS };
  if (!input || typeof input !== 'object') return base;
  for (const key of Object.keys(base)) {
    if (typeof input[key] === 'boolean') base[key] = input[key];
  }
  return base;
}
