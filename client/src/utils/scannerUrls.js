import {
  sanitizeStoreRecord,
  storeHasValidExtractedData,
} from './contactValidation.js';

export function normalizeStoreUrl(input) {
  const raw = (input || '').trim().replace(/^[\s"'`<>()[\]]+|[\s"'`<>()[\]]+$/g, '');
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (!url.match(/^https?:\/\//)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

export const MAX_URLS_PER_SCAN = 1000;

export function parseUrls(text) {
  const raw = (text || '')
    .replace(/,/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const urls = [];
  for (const s of raw) {
    const normalized = normalizeStoreUrl(s);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

/** How many URLs will actually be scanned given batch + quota caps. */
export function computeScanAllowance(urlCount, { maxPerScan = MAX_URLS_PER_SCAN, scansRemaining = MAX_URLS_PER_SCAN } = {}) {
  const batchCap = Math.max(0, maxPerScan);
  const quotaCap = scansRemaining >= 999999 ? batchCap : Math.max(0, scansRemaining);
  return Math.min(urlCount, batchCap, quotaCap);
}

export function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || 'Unknown store';
  }
}

const PROVIDER_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'msn.com',
  'hotmail.com',
  'hotmail.co.uk',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'mac.com',
];

/** @returns {'provider' | 'domain'} */
export function classifyCampaignEmail(email, storeUrl = '') {
  const at = String(email || '').lastIndexOf('@');
  if (at === -1) return 'domain';
  const emailDomain = email.slice(at + 1).toLowerCase();
  const storeHost = domainFromUrl(storeUrl).toLowerCase();
  const isProvider = PROVIDER_EMAIL_DOMAINS.some(
    (p) => emailDomain === p || emailDomain.endsWith(`.${p}`)
  );
  if (isProvider) return 'provider';
  if (storeHost && (emailDomain === storeHost || emailDomain.endsWith(`.${storeHost}`))) {
    return 'domain';
  }
  return 'domain';
}

export function filterCampaignRecipients(
  recipients,
  {
    includeProvider = true,
    includeDomain = true,
    includeWhatsapp = false,
    includeInstagram = false,
    includeTiktok = false,
  } = {}
) {
  if (!Array.isArray(recipients)) return [];

  const emailSelected = includeProvider || includeDomain;
  const socialSelected = includeWhatsapp || includeInstagram || includeTiktok;
  if (!emailSelected && !socialSelected) return [];

  return recipients.filter((r) => {
    const email = String(r.email || '').trim();
    const hasEmail = email.includes('@');
    let emailMatch = false;
    if (emailSelected && hasEmail) {
      const type = classifyCampaignEmail(email, r.storeUrl || r.store_url);
      emailMatch =
        (type === 'provider' && includeProvider) || (type === 'domain' && includeDomain);
    }
    const socialMatch =
      (includeWhatsapp && r.whatsapp) ||
      (includeInstagram && r.instagram) ||
      (includeTiktok && r.tiktok);

    if (emailSelected && socialSelected) return emailMatch || socialMatch;
    if (emailSelected) return emailMatch;
    return socialMatch;
  });
}

export function countCampaignChannelsByType(recipients) {
  const counts = {
    provider: 0,
    domain: 0,
    whatsapp: 0,
    instagram: 0,
    tiktok: 0,
  };
  for (const r of recipients || []) {
    const email = String(r.email || '').trim();
    if (email.includes('@')) {
      if (classifyCampaignEmail(email, r.storeUrl || r.store_url) === 'provider') {
        counts.provider += 1;
      } else {
        counts.domain += 1;
      }
    }
    if (r.whatsapp) counts.whatsapp += 1;
    if (r.instagram) counts.instagram += 1;
    if (r.tiktok) counts.tiktok += 1;
  }
  return counts;
}

export function countCampaignEmailsByType(recipients) {
  let provider = 0;
  let domain = 0;
  for (const r of recipients || []) {
    if (classifyCampaignEmail(r.email, r.storeUrl || r.store_url) === 'provider') provider += 1;
    else domain += 1;
  }
  return { provider, domain };
}

export function recipientsFromResults(results) {
  if (!Array.isArray(results)) return [];
  return results.flatMap((store) => {
    const base = {
      storeUrl: store.storeUrl || store.store_url || '',
      whatsapp: store.whatsapp || null,
      instagram: store.instagram || null,
      tiktok: store.tiktok || null,
    };
    const emails = store.emails || [];
    if (!emails.length) return [];
    return emails.map((e) => ({
      ...base,
      email: e.email,
    }));
  });
}

export function recipientsToScanResults(recipients) {
  if (!Array.isArray(recipients)) return [];
  const byStore = new Map();
  for (const r of recipients) {
    const storeUrl = r.storeUrl || r.store_url || '';
    if (!byStore.has(storeUrl)) {
      byStore.set(storeUrl, {
        storeUrl,
        emails: [],
        whatsapp: r.whatsapp || null,
        instagram: r.instagram || null,
        tiktok: r.tiktok || null,
      });
    }
    const row = byStore.get(storeUrl);
    if (r.whatsapp && !row.whatsapp) row.whatsapp = r.whatsapp;
    if (r.instagram && !row.instagram) row.instagram = r.instagram;
    if (r.tiktok && !row.tiktok) row.tiktok = r.tiktok;
    if (r.email) row.emails.push({ email: r.email });
  }
  return [...byStore.values()];
}

export function summarizeExtractedCounts(results, extractOptions) {
  const counts = { email: 0, phone: 0, whatsapp: 0, instagram: 0, tiktok: 0 };
  for (const store of (results || []).map(sanitizeStoreRecord).filter(Boolean)) {
    if (extractOptions?.email && store.emails?.length) counts.email += 1;
    if (extractOptions?.phone && store.phone) counts.phone += 1;
    if (extractOptions?.whatsapp && store.whatsapp) counts.whatsapp += 1;
    if (extractOptions?.instagram && store.instagram) counts.instagram += 1;
    if (extractOptions?.tiktok && store.tiktok) counts.tiktok += 1;
  }
  return counts;
}

export function formatExtractedSummary(results, extractOptions, fallbackFoundCount = 0) {
  const counts = summarizeExtractedCounts(results, extractOptions);
  const parts = [];
  if (extractOptions?.email && counts.email) {
    parts.push(`${counts.email} email${counts.email !== 1 ? 's' : ''}`);
  }
  if (extractOptions?.phone && counts.phone) {
    parts.push(`${counts.phone} phone${counts.phone !== 1 ? 's' : ''}`);
  }
  if (extractOptions?.whatsapp && counts.whatsapp) {
    parts.push(`${counts.whatsapp} WhatsApp`);
  }
  if (extractOptions?.instagram && counts.instagram) {
    parts.push(`${counts.instagram} IG`);
  }
  if (extractOptions?.tiktok && counts.tiktok) {
    parts.push(`${counts.tiktok} TikTok`);
  }
  if (parts.length) return parts.join(' · ');
  if (fallbackFoundCount > 0) {
    return `${fallbackFoundCount} store${fallbackFoundCount !== 1 ? 's' : ''} with contacts`;
  }
  return '0 contacts found';
}

export function storesWithExtractedData(results, extractOptions) {
  if (!Array.isArray(results)) return [];
  return results
    .map(sanitizeStoreRecord)
    .filter(Boolean)
    .filter((store) => storeHasValidExtractedData(store, extractOptions));
}

function rowHasSelectedData(store, fields) {
  if (fields.email && store.emails?.length) return true;
  if (fields.phone && store.phone) return true;
  if (fields.whatsapp && store.whatsapp) return true;
  if (fields.instagram && store.instagram) return true;
  if (fields.tiktok && store.tiktok) return true;
  return false;
}

function buildExportRow(store, columns, email = '') {
  const row = [];
  for (const col of columns) {
    if (col === 'storeUrl') row.push(store.storeUrl || '');
    else if (col === 'email') row.push(email || '');
    else if (col === 'phone') row.push(store.phone || '');
    else if (col === 'whatsapp') row.push(store.whatsapp || '');
    else if (col === 'instagram') row.push(store.instagram || '');
    else if (col === 'tiktok') row.push(store.tiktok || '');
    else row.push('');
  }
  return row;
}

export function exportScanResultsCsv(results, fields) {
  const sanitized = (results || []).map(sanitizeStoreRecord).filter(Boolean);
  const withData = sanitized.filter((store) => rowHasSelectedData(store, fields));
  if (!withData.length) return 0;
  const columns = ['storeUrl'];
  if (fields.email) columns.push('email');
  if (fields.phone) columns.push('phone');
  if (fields.whatsapp) columns.push('whatsapp');
  if (fields.instagram) columns.push('instagram');
  if (fields.tiktok) columns.push('tiktok');

  const header = columns.map((key) => {
    if (key === 'storeUrl') return 'Store URL';
    if (key === 'email') return 'Email';
    if (key === 'phone') return 'Phone';
    if (key === 'whatsapp') return 'WhatsApp';
    if (key === 'instagram') return 'Instagram';
    return 'TikTok';
  });

  const rows = [header];
  for (const store of withData) {
    if (!rowHasSelectedData(store, fields)) continue;

    const emails = fields.email
      ? (store.emails || []).map((e) => e.email).filter(Boolean)
      : [];

    if (fields.email && emails.length > 1) {
      for (const email of emails) {
        rows.push(buildExportRow(store, columns, email));
      }
    } else {
      const email = emails[0] || '';
      rows.push(buildExportRow(store, columns, email));
    }
  }

  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = `\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  a.download = `wiblaster-kel${suffix}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return rows.length - 1;
}
