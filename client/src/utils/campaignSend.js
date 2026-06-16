export function fillTemplate(text, recipient) {
  const storeUrl = recipient?.storeUrl || recipient?.store_url || '';
  const domain = storeUrl.replace(/^https?:\/\//, '').split('/')[0] || '';
  return String(text || '')
    .replace(/\{\{store_url\}\}/gi, storeUrl)
    .replace(/\{\{store_domain\}\}/gi, domain)
    .replace(/\{\{email\}\}/gi, recipient?.email || '');
}

export function buildMailtoUrl({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const qs = params.toString();
  const addr = encodeURIComponent(to || '');
  return `mailto:${addr}${qs ? `?${qs}` : ''}`;
}

export function appendTrackingPixel(body, trackUrl) {
  if (!trackUrl) return body;
  return `${body}\n\n<img src="${trackUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;
}
