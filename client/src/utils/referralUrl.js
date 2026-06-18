const CANONICAL_SITE = 'https://wiblaster.com';

/** One clean referral signup URL — canonical domain in production, local origin in dev. */
export function buildReferralSignupUrl(referralCode) {
  const code = String(referralCode || '').trim();
  if (!code) return '';

  if (typeof window !== 'undefined') {
    const origin = window.location.origin || '';
    if (/localhost|127\.0\.0\.1/i.test(origin)) {
      return `${origin}/signup?ref=${encodeURIComponent(code)}`;
    }
    try {
      const host = window.location.hostname.toLowerCase();
      if (host === 'wiblaster.com' || host === 'www.wiblaster.com') {
        return `${CANONICAL_SITE}/signup?ref=${encodeURIComponent(code)}`;
      }
    } catch (_) {}
  }

  return `${CANONICAL_SITE}/signup?ref=${encodeURIComponent(code)}`;
}

/** Strip duplicate hosts if API returns a malformed comma-separated URL. */
export function sanitizeReferralUrl(url, referralCode) {
  const fromCode = buildReferralSignupUrl(referralCode);
  if (fromCode) return fromCode;

  const raw = String(url || '').trim();
  if (!raw) return '';

  const first = raw.split(',')[0].trim();
  try {
    const parsed = new URL(first.startsWith('http') ? first : `https://${first}`);
    const code = new URLSearchParams(parsed.search).get('ref') || referralCode;
    if (parsed.hostname.toLowerCase().replace(/^www\./, '') === 'wiblaster.com' && code) {
      return `${CANONICAL_SITE}/signup?ref=${encodeURIComponent(code)}`;
    }
    return parsed.href;
  } catch {
    return first;
  }
}
