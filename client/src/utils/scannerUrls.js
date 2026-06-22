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
  return urls.slice(0, 500);
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

export function filterCampaignRecipients(recipients, { includeProvider = true, includeDomain = true } = {}) {
  if (!Array.isArray(recipients)) return [];
  return recipients.filter((r) => {
    const type = classifyCampaignEmail(r.email, r.storeUrl || r.store_url);
    if (type === 'provider') return includeProvider;
    return includeDomain;
  });
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
  return results.flatMap((store) =>
    (store.emails || []).map((e) => ({
      storeUrl: store.storeUrl || store.store_url || '',
      email: e.email,
    }))
  );
}

export function recipientsToScanResults(recipients) {
  if (!Array.isArray(recipients)) return [];
  const byStore = new Map();
  for (const r of recipients) {
    const storeUrl = r.storeUrl || r.store_url || '';
    if (!byStore.has(storeUrl)) byStore.set(storeUrl, { storeUrl, emails: [] });
    if (r.email) byStore.get(storeUrl).emails.push({ email: r.email });
  }
  return [...byStore.values()];
}

export function storesWithExtractedData(results, extractOptions) {
  if (!Array.isArray(results)) return [];
  return results.filter((store) => {
    if (extractOptions?.email && store.emails?.length) return true;
    if (extractOptions?.phone && store.phone) return true;
    if (extractOptions?.whatsapp && store.whatsapp) return true;
    if (extractOptions?.instagram && store.instagram) return true;
    if (extractOptions?.tiktok && store.tiktok) return true;
    return false;
  });
}

export function exportScanResultsCsv(results, fields, extractOptions) {
  const withData = storesWithExtractedData(results, extractOptions);
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
    const emails = fields.email && store.emails?.length ? store.emails.map((e) => e.email) : [''];
    const iterations = fields.email ? emails : [null];
    for (const email of iterations) {
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
      if (fields.email && !email) continue;
      rows.push(row);
    }
  }

  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scan-export-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
