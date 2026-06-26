const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(value) {
  const trimmed = String(value || '').trim();
  return trimmed.length > 0 && EMAIL_REGEX.test(trimmed);
}

function isLikelyStoreUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || isEmail(trimmed)) return false;
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed) ||
    /\.[a-z]{2,}(?:\/|$)/i.test(trimmed)
  );
}

/** Split a single CSV line, respecting double-quoted fields. */
export function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^["']|["']$/g, '').trim());
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function headerEmailIndex(headers) {
  return headers.findIndex((h) => /^(email|e_mail|e-mail|email_address|emailaddress|mail)$/.test(h) || h.includes('email'));
}

function headerUrlIndex(headers) {
  return headers.findIndex(
    (h) =>
      /^(store_url|storeurl|url|link|store|website|store_link|domain|shop)$/.test(h) ||
      h.includes('store') ||
      h === 'link'
  );
}

function scoreColumns(sampleRows) {
  const maxCols = Math.max(0, ...sampleRows.map((row) => row.length));
  const emailScores = Array(maxCols).fill(0);
  const urlScores = Array(maxCols).fill(0);

  for (const row of sampleRows) {
    row.forEach((cell, idx) => {
      if (isEmail(cell)) emailScores[idx] += 1;
      if (isLikelyStoreUrl(cell)) urlScores[idx] += 1;
    });
  }

  let emailIdx = -1;
  let bestEmailScore = 0;
  emailScores.forEach((score, idx) => {
    if (score > bestEmailScore) {
      bestEmailScore = score;
      emailIdx = idx;
    }
  });

  let urlIdx = -1;
  let bestUrlScore = 0;
  urlScores.forEach((score, idx) => {
    if (idx === emailIdx) return;
    if (score > bestUrlScore) {
      bestUrlScore = score;
      urlIdx = idx;
    }
  });

  if (emailIdx >= 0 && urlIdx === -1 && maxCols === 2) {
    urlIdx = emailIdx === 1 ? 0 : 1;
  }

  return { emailIdx, urlIdx, bestEmailScore };
}

/**
 * Parse campaign recipient CSV.
 * Supports store URL in column 1 and email in column 2 (with or without headers).
 */
export function parseRecipientCsv(text) {
  const cleaned = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim();
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(splitCsvLine);
  const normalizedHeader = rows[0].map(normalizeHeader);
  const headerEmailIdx = headerEmailIndex(normalizedHeader);
  const headerUrlIdx = headerUrlIndex(normalizedHeader);
  const firstRowHasEmail = rows[0].some(isEmail);
  const secondRowHasEmail = rows.length > 1 && rows[1].some(isEmail);

  let startIdx = 0;
  let emailIdx = -1;
  let urlIdx = -1;

  if (!firstRowHasEmail && headerEmailIdx >= 0) {
    startIdx = 1;
    emailIdx = headerEmailIdx;
    urlIdx = headerUrlIdx;
  } else if (!firstRowHasEmail && secondRowHasEmail) {
    startIdx = 1;
    const detected = scoreColumns(rows.slice(1, Math.min(6, rows.length)));
    emailIdx = detected.emailIdx;
    urlIdx = detected.urlIdx;
  } else {
    const detected = scoreColumns(rows.slice(0, Math.min(6, rows.length)));
    emailIdx = detected.emailIdx;
    urlIdx = detected.urlIdx;
    startIdx = 0;
  }

  if (emailIdx < 0) {
    const detected = scoreColumns(rows.slice(startIdx, Math.min(startIdx + 6, rows.length)));
    emailIdx = detected.emailIdx;
    if (urlIdx < 0) urlIdx = detected.urlIdx;
  }

  const recipients = [];
  for (let i = startIdx; i < rows.length; i += 1) {
    const cells = rows[i];
    if (!cells.length) continue;

    let email = emailIdx >= 0 ? String(cells[emailIdx] || '').trim() : '';
    if (!isEmail(email)) {
      const found = cells.find((cell) => isEmail(cell));
      email = found ? found.trim() : '';
    }
    if (!isEmail(email)) continue;

    let storeUrl = urlIdx >= 0 ? String(cells[urlIdx] || '').trim() : '';
    if (!storeUrl || isEmail(storeUrl)) {
      storeUrl = cells.find((cell) => isLikelyStoreUrl(cell))?.trim() || '';
    }

    recipients.push({ email, storeUrl: storeUrl || email });
  }

  return recipients;
}
