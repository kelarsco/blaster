import dns from 'dns/promises';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'throwaway.email', 'yopmail.com',
]);

export async function verifyEmailAddress(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  const domain = normalized.split('@')[1];
  if (!domain || DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Email domain not deliverable' };
  }

  try {
    const mx = await dns.resolveMx(domain);
    if (!mx?.length) {
      return { valid: false, reason: 'No mail server found for domain' };
    }
    return { valid: true, email: normalized };
  } catch {
    try {
      const a = await dns.resolve4(domain);
      if (a?.length) return { valid: true, email: normalized };
    } catch (_) {}
    return { valid: false, reason: 'Domain could not be verified' };
  }
}
