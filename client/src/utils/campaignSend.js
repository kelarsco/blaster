export function fillTemplate(text, recipient) {
  const storeUrl = recipient?.storeUrl || recipient?.store_url || '';
  const domain = storeUrl.replace(/^https?:\/\//, '').split('/')[0] || '';
  return String(text || '')
    .replace(/\{\{store_url\}\}/gi, storeUrl)
    .replace(/\{\{store_domain\}\}/gi, domain)
    .replace(/\{\{email\}\}/gi, recipient?.email || '');
}

/** Plain-text mailto — uses encodeURIComponent so spaces stay spaces (not +). */
export function buildMailtoUrl({ to, from, subject, body }) {
  const toEnc = encodeURIComponent(to || '');
  const params = [];
  if (from) params.push(`from=${encodeURIComponent(from)}`);
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const qs = params.join('&');
  return `mailto:${toEnc}${qs ? `?${qs}` : ''}`;
}

/** Open mailto without unloading the page (keeps in-flight send logging alive). */
export function openMailtoUrl(url) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/** Invisible 1×1 open tracker for HTML emails (not visible in compose — use with SMTP/HTML send). */
export function buildInvisibleTrackingPixel(trackUrl) {
  if (!trackUrl) return '';
  const src = String(trackUrl).replace(/"/g, '&quot;');
  return `<img src="${src}" width="1" height="1" alt="" border="0" style="width:1px!important;height:1px!important;max-width:1px!important;max-height:1px!important;opacity:0!important;visibility:hidden!important;display:block!important;border:0!important;line-height:0!important;font-size:0!important;mso-hide:all;" />`;
}

/** HTML body with invisible tracking pixel (server sends this; mailto cannot use HTML). */
export function buildHtmlEmailWithTrackingPixel(plainBody, trackUrl) {
  const escaped = String(plainBody || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const htmlBody = escaped.replace(/\r\n|\n|\r/g, '<br>\n');
  const pixel = buildInvisibleTrackingPixel(trackUrl);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-size:14px;color:#111;line-height:1.5;">${htmlBody}${pixel}</body></html>`;
}
