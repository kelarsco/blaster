const PROVIDER_LABELS = {
  sendgrid: 'SendGrid',
  mailgun: 'Mailgun',
  ses: 'Amazon SES',
  resend: 'Resend',
};

export const DOMAIN_EMAIL_PROVIDERS = Object.freeze([
  { id: 'sendgrid', label: PROVIDER_LABELS.sendgrid },
  { id: 'mailgun', label: PROVIDER_LABELS.mailgun },
  { id: 'ses', label: PROVIDER_LABELS.ses },
  { id: 'resend', label: PROVIDER_LABELS.resend },
]);

function normalizeProvider(provider) {
  const id = String(provider || '').trim().toLowerCase();
  return DOMAIN_EMAIL_PROVIDERS.some((p) => p.id === id) ? id : null;
}

export function normalizeDomainInput(domain) {
  const d = String(domain || '').trim().toLowerCase();
  if (!d) return '';
  return d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

function providerTokenSeed(domain) {
  return Buffer.from(domain).toString('hex').slice(0, 12);
}

export function buildProviderDnsRecords(provider, domain) {
  const p = normalizeProvider(provider);
  const cleanDomain = normalizeDomainInput(domain);
  if (!p || !cleanDomain) return [];
  const seed = providerTokenSeed(cleanDomain);

  if (p === 'resend') {
    return [
      { type: 'TXT', host: cleanDomain, value: 'v=spf1 include:spf.resend.com ~all', purpose: 'SPF' },
      { type: 'TXT', host: `resend._domainkey.${cleanDomain}`, value: `k=rsa; p=<resend-dkim-public-key-${seed}>`, purpose: 'DKIM' },
      { type: 'TXT', host: `_dmarc.${cleanDomain}`, value: 'v=DMARC1; p=none; rua=mailto:dmarc@' + cleanDomain, purpose: 'DMARC' },
      { type: 'CNAME', host: `track.${cleanDomain}`, value: 'u.resend.com', purpose: 'Tracking (optional)' },
    ];
  }

  if (p === 'sendgrid') {
    return [
      { type: 'TXT', host: cleanDomain, value: 'v=spf1 include:sendgrid.net ~all', purpose: 'SPF' },
      { type: 'CNAME', host: `s1._domainkey.${cleanDomain}`, value: `s1.domainkey.u${seed}.wl.sendgrid.net`, purpose: 'DKIM' },
      { type: 'CNAME', host: `s2._domainkey.${cleanDomain}`, value: `s2.domainkey.u${seed}.wl.sendgrid.net`, purpose: 'DKIM' },
      { type: 'TXT', host: `_dmarc.${cleanDomain}`, value: 'v=DMARC1; p=none; rua=mailto:dmarc@' + cleanDomain, purpose: 'DMARC' },
      { type: 'CNAME', host: `em.${cleanDomain}`, value: `u${seed}.wlsendgrid.net`, purpose: 'Tracking (optional)' },
    ];
  }

  if (p === 'mailgun') {
    return [
      { type: 'TXT', host: cleanDomain, value: 'v=spf1 include:mailgun.org ~all', purpose: 'SPF' },
      { type: 'TXT', host: `krs._domainkey.${cleanDomain}`, value: `k=rsa; p=<mailgun-dkim-public-key-${seed}>`, purpose: 'DKIM' },
      { type: 'TXT', host: `_dmarc.${cleanDomain}`, value: 'v=DMARC1; p=none; rua=mailto:dmarc@' + cleanDomain, purpose: 'DMARC' },
      { type: 'CNAME', host: `email.${cleanDomain}`, value: 'mailgun.org', purpose: 'Tracking (optional)' },
    ];
  }

  // Amazon SES template.
  return [
    { type: 'TXT', host: cleanDomain, value: 'v=spf1 include:amazonses.com ~all', purpose: 'SPF' },
    { type: 'CNAME', host: `<selector1>._domainkey.${cleanDomain}`, value: '<selector1>.dkim.amazonses.com', purpose: 'DKIM' },
    { type: 'CNAME', host: `<selector2>._domainkey.${cleanDomain}`, value: '<selector2>.dkim.amazonses.com', purpose: 'DKIM' },
    { type: 'CNAME', host: `<selector3>._domainkey.${cleanDomain}`, value: '<selector3>.dkim.amazonses.com', purpose: 'DKIM' },
    { type: 'TXT', host: `_dmarc.${cleanDomain}`, value: 'v=DMARC1; p=none; rua=mailto:dmarc@' + cleanDomain, purpose: 'DMARC' },
    { type: 'CNAME', host: `track.${cleanDomain}`, value: '<custom-mail-from-domain>', purpose: 'Tracking (optional)' },
  ];
}

function getProviderApiKey(provider, explicitApiKey) {
  const direct = String(explicitApiKey || '').trim();
  if (direct) return direct;
  if (provider === 'sendgrid') return process.env.SENDGRID_API_KEY || '';
  if (provider === 'mailgun') return process.env.MAILGUN_API_KEY || '';
  if (provider === 'ses') return process.env.AWS_SES_API_KEY || '';
  if (provider === 'resend') return process.env.RESEND_API_KEY || '';
  return '';
}

async function readJsonSafe(response) {
  return response.json().catch(() => ({}));
}

function resendErrorMessage(data, fallback) {
  return data?.message || data?.error?.message || data?.error || fallback;
}

function mapResendRecords(records, domain) {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return [];
  return list.map((r) => ({
    type: String(r?.record || r?.type || '').toUpperCase(),
    host: String(r?.name || r?.host || ''),
    value: String(r?.value || ''),
    purpose: String(r?.type || r?.record || 'DNS').toUpperCase(),
  }));
}

export async function createOrLocateProviderDomain({ provider, domain, apiKey }) {
  const p = normalizeProvider(provider);
  const d = normalizeDomainInput(domain);
  const key = getProviderApiKey(p, apiKey);
  if (!p || !d) return { ok: false, reason: 'Invalid provider/domain' };
  if (!key) return { ok: false, reason: 'No provider API key configured yet' };

  if (p !== 'resend') return { ok: true };

  try {
    const listRes = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const listData = await readJsonSafe(listRes);
    if (!listRes.ok) {
      return { ok: false, reason: resendErrorMessage(listData, `Resend domains lookup failed (${listRes.status})`) };
    }
    const found = (listData?.data || []).find((x) => String(x?.name || '').toLowerCase() === d);
    if (found) {
      return {
        ok: true,
        providerDomainId: found.id || null,
        status: String(found.status || '').toLowerCase() || 'pending',
        dnsRecords: mapResendRecords(found.records, d),
      };
    }

    const createRes = await fetch('https://api.resend.com/domains', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d }),
    });
    const createData = await readJsonSafe(createRes);
    if (!createRes.ok) {
      return { ok: false, reason: resendErrorMessage(createData, `Resend domain create failed (${createRes.status})`) };
    }
    return {
      ok: true,
      providerDomainId: createData?.id || null,
      status: String(createData?.status || '').toLowerCase() || 'pending',
      dnsRecords: mapResendRecords(createData?.records, d),
    };
  } catch (e) {
    return { ok: false, reason: e?.message || 'Resend domain setup failed' };
  }
}

export async function verifyDomainWithProvider({ provider, domain, providerDomainId, apiKey }) {
  const p = normalizeProvider(provider);
  const d = normalizeDomainInput(domain);
  const key = getProviderApiKey(p, apiKey);
  if (!p || !d) return { verified: false, reason: 'Invalid provider/domain' };
  if (!key) return { verified: false, reason: 'No provider API key configured yet' };

  try {
    if (p === 'resend') {
      let resolvedDomainId = providerDomainId || null;
      if (!resolvedDomainId) {
        const setup = await createOrLocateProviderDomain({ provider: p, domain: d, apiKey: key });
        if (!setup.ok) return { verified: false, reason: setup.reason || 'Resend domain setup failed' };
        resolvedDomainId = setup.providerDomainId || null;
      }
      const target = providerDomainId
        ? `https://api.resend.com/domains/${encodeURIComponent(providerDomainId)}`
        : `https://api.resend.com/domains`;
      const r = await fetch(
        resolvedDomainId ? `https://api.resend.com/domains/${encodeURIComponent(resolvedDomainId)}` : target,
        { headers: { Authorization: `Bearer ${key}` } }
      );
      const data = await readJsonSafe(r);
      if (!r.ok) {
        return { verified: false, reason: resendErrorMessage(data, `Resend verification check failed (${r.status})`) };
      }
      const domainObj = resolvedDomainId
        ? data
        : (data?.data || []).find((x) => String(x?.name || '').toLowerCase() === d);
      const status = String(domainObj?.status || '').toLowerCase();
      const verified = status === 'verified';
      return {
        verified,
        providerDomainId: domainObj?.id || resolvedDomainId || null,
        dnsRecords: mapResendRecords(domainObj?.records, d),
        reason: verified ? null : `Status: ${status || 'pending'}`,
      };
    }

    if (p === 'sendgrid') {
      if (!providerDomainId) return { verified: false, reason: 'SendGrid domain id is not set yet' };
      const r = await fetch(`https://api.sendgrid.com/v3/whitelabel/domains/${encodeURIComponent(providerDomainId)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) return { verified: false, reason: `SendGrid verification check failed (${r.status})` };
      const data = await r.json().catch(() => ({}));
      const valid = !!data?.valid;
      return { verified: valid, providerDomainId, reason: valid ? null : 'Status: pending' };
    }

    if (p === 'mailgun') {
      const r = await fetch(`https://api.mailgun.net/v4/domains/${encodeURIComponent(d)}`, {
        headers: { Authorization: 'Basic ' + Buffer.from(`api:${key}`).toString('base64') },
      });
      if (!r.ok) return { verified: false, reason: `Mailgun verification check failed (${r.status})` };
      const data = await r.json().catch(() => ({}));
      const state = String(data?.domain?.state || '').toLowerCase();
      const verified = state === 'active';
      return { verified, providerDomainId: data?.domain?.id || providerDomainId || null, reason: verified ? null : `Status: ${state || 'pending'}` };
    }

    // SES verification polling needs AWS SigV4 and account-level setup.
    return { verified: false, reason: 'Use SES webhook/poller integration with AWS credentials to auto-verify' };
  } catch (e) {
    return { verified: false, reason: e?.message || 'Verification failed' };
  }
}

export async function sendEmailViaProvider({
  provider,
  apiKey,
  fromName,
  fromEmail,
  toEmail,
  subject,
  textBody,
  replyTo,
  inReplyTo,
  references,
  metadata,
}) {
  const p = normalizeProvider(provider);
  const key = getProviderApiKey(p, apiKey);
  if (!p) throw new Error('Unsupported provider');
  if (!key) throw new Error(`Missing ${PROVIDER_LABELS[p]} API key`);
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  if (p === 'resend') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject,
        text: textBody || '',
        reply_to: replyTo || fromEmail,
        headers: {
          ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}),
          ...(references ? { References: references } : {}),
        },
        tags: metadata ? Object.entries(metadata).map(([name, value]) => ({ name, value: String(value) })) : undefined,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Resend send failed (${r.status})`);
    return { messageId: data?.id || null };
  }

  if (p === 'sendgrid') {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: fromName || undefined },
        reply_to: { email: replyTo || fromEmail },
        subject,
        content: [{ type: 'text/plain', value: textBody || '' }],
        headers: {
          ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}),
          ...(references ? { References: references } : {}),
        },
      }),
    });
    if (!r.ok) throw new Error(`SendGrid send failed (${r.status})`);
    return { messageId: r.headers.get('x-message-id') || null };
  }

  if (p === 'mailgun') {
    const domain = fromEmail.split('@')[1];
    const form = new URLSearchParams();
    form.set('from', from);
    form.set('to', toEmail);
    form.set('subject', subject);
    form.set('text', textBody || '');
    form.set('h:Reply-To', replyTo || fromEmail);
    if (inReplyTo) form.set('h:In-Reply-To', inReplyTo);
    if (references) form.set('h:References', references);
    const r = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`api:${key}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Mailgun send failed (${r.status})`);
    return { messageId: data?.id || null };
  }

  throw new Error('Amazon SES API adapter needs AWS IAM SigV4 configuration');
}

export function parseInboundPayload(provider, body) {
  const p = normalizeProvider(provider);
  const b = body || {};
  const toAddress = (v) => {
    if (Array.isArray(v)) return toAddress(v[0]);
    if (v && typeof v === 'object') return toAddress(v.email || v.address || v.value || '');
    const s = String(v || '');
    const m = s.match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i);
    return (m?.[1] || '').toLowerCase();
  };

  if (p === 'mailgun') {
    return {
      fromEmail: toAddress(b.sender || b.from),
      toEmail: toAddress(b.recipient || b.To),
      subject: String(b.subject || '').trim(),
      text: String(b['body-plain'] || b.text || '').trim(),
      messageId: String(b['Message-Id'] || b.message_id || '').trim(),
      inReplyTo: String(b['In-Reply-To'] || b.in_reply_to || '').trim(),
      references: String(b.References || b.references || '').trim(),
    };
  }

  if (p === 'resend') {
    return {
      fromEmail: toAddress(b?.data?.from || b?.from || b?.data?.from_email),
      toEmail: toAddress(b?.data?.to || b?.to || b?.data?.to_email),
      subject: String(b?.data?.subject || b?.subject || '').trim(),
      text: String(b?.data?.text || b?.text || '').trim(),
      messageId: String(b?.data?.id || b?.id || b?.data?.message_id || '').trim(),
      inReplyTo: String(
        b?.data?.headers?.['In-Reply-To'] ||
        b?.data?.headers?.['in-reply-to'] ||
        b?.inReplyTo ||
        b?.in_reply_to ||
        ''
      ).trim(),
      references: String(b?.data?.headers?.References || b?.data?.headers?.references || b?.references || '').trim(),
    };
  }

  // Generic fallback for providers/webhook relays.
  return {
    fromEmail: toAddress(b.from || b.sender),
    toEmail: toAddress(b.to || b.recipient),
    subject: String(b.subject || '').trim(),
    text: String(b.text || b.body || '').trim(),
    messageId: String(b.messageId || b.message_id || '').trim(),
    inReplyTo: String(b.inReplyTo || b.in_reply_to || '').trim(),
    references: String(b.references || '').trim(),
  };
}
