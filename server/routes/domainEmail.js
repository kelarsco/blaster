import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logActivity } from './activity.js';
import { getSenderLimitForUser } from '../services/planLimits.js';
import {
  createOrLocateProviderDomain,
  DOMAIN_EMAIL_PROVIDERS,
  buildProviderDnsRecords,
  ensureProviderInboundWebhook,
  normalizeDomainInput,
  parseInboundPayload,
  sendEmailViaProvider,
  verifyDomainWithProvider,
} from '../services/domainEmailProviders.js';

export const domainEmailRoutes = Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isValidDomain(domain) {
  const d = normalizeDomainInput(domain);
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(d);
}

function normalizeMessageId(value) {
  return String(value || '').trim().replace(/^<+|>+$/g, '').toLowerCase();
}

function extractMessageIdCandidates(inReplyTo, references) {
  const out = new Set();
  const add = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return;
    const angleMatches = s.match(/<[^>]+>/g) || [];
    if (angleMatches.length) {
      for (const m of angleMatches) {
        const norm = normalizeMessageId(m);
        if (norm) out.add(norm);
      }
      return;
    }
    for (const token of s.split(/\s+/)) {
      const norm = normalizeMessageId(token);
      if (norm) out.add(norm);
    }
  };
  add(inReplyTo);
  add(references);
  return Array.from(out);
}

function ensureReplySubject(subject) {
  const s = String(subject || '').trim();
  if (!s) return 'Re: Campaign response';
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

function serializeDomainRow(row) {
  return {
    id: row.id,
    domain: row.domain,
    provider: row.provider,
    providerDomainId: row.provider_domain_id,
    status: row.status || 'pending',
    verificationError: row.verification_error || null,
    inboundWebhookUrl: row.inbound_webhook_url || null,
    inboundWebhookStatus: row.inbound_webhook_status || 'pending',
    inboundWebhookError: row.inbound_webhook_error || null,
    inboundWebhookSyncedAt: row.inbound_webhook_synced_at || null,
    lastVerifiedAt: row.last_verified_at || null,
    dnsRecords: (() => {
      try {
        return JSON.parse(row.dns_records_json || '[]');
      } catch {
        return [];
      }
    })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveBackendPublicUrl(req) {
  const raw =
    process.env.BACKEND_URL ||
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    process.env.RENDER_EXTERNAL_URL ||
    `${req.protocol}://${req.get('host')}`;
  const trimmed = String(raw || '').trim();
  if (!trimmed) return `${req.protocol}://${req.get('host')}`;
  return /^https?:\/\//i.test(trimmed) ? trimmed.replace(/\/$/, '') : `https://${trimmed.replace(/\/$/, '')}`;
}

function buildInboundWebhookUrl(req, provider, domainId) {
  return `${resolveBackendPublicUrl(req)}/api/domain-email/webhooks/${encodeURIComponent(provider)}/${encodeURIComponent(domainId)}`;
}

async function syncInboundWebhookForDomain(db, req, domainRow) {
  const webhookUrl = buildInboundWebhookUrl(req, domainRow.provider, domainRow.id);
  const webhookSecret = String(process.env.DOMAIN_EMAIL_WEBHOOK_SECRET || '').trim();
  const sync = await ensureProviderInboundWebhook({
    provider: domainRow.provider,
    providerDomainId: domainRow.provider_domain_id,
    apiKey: domainRow.provider_api_key,
    webhookUrl,
    webhookSecret,
  });
  await db.query(
    `UPDATE sending_domains
     SET inbound_webhook_url = $1,
         inbound_webhook_provider_id = $2,
         inbound_webhook_status = $3,
         inbound_webhook_error = $4,
         inbound_webhook_synced_at = NOW(),
         updated_at = NOW()
     WHERE id = $5 AND user_id = $6`,
    [
      webhookUrl,
      sync?.webhookId || null,
      sync?.configured ? 'configured' : (sync?.manualRequired ? 'manual_required' : 'pending'),
      sync?.reason || null,
      domainRow.id,
      domainRow.user_id,
    ]
  );
  return sync;
}

async function upsertThread(db, { userId, domainId, senderEmail, contactEmail, campaignId, subject }) {
  const threadId = uuidv4();
  const result = await db.query(
    `INSERT INTO domain_inbox_threads (id, user_id, domain_id, sender_email, contact_email, campaign_id, subject, last_message_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
     ON CONFLICT (user_id, domain_id, sender_email, contact_email)
     DO UPDATE SET
       campaign_id = COALESCE(domain_inbox_threads.campaign_id, EXCLUDED.campaign_id),
       subject = COALESCE(EXCLUDED.subject, domain_inbox_threads.subject),
       last_message_at = NOW(),
       updated_at = NOW()
     RETURNING id`,
    [threadId, userId, domainId, normalizeEmail(senderEmail), normalizeEmail(contactEmail), campaignId || null, subject || null]
  );
  return result.rows?.[0]?.id || threadId;
}

domainEmailRoutes.get('/providers', requireAuth, async (_req, res) => {
  res.json({ providers: DOMAIN_EMAIL_PROVIDERS });
});

domainEmailRoutes.get('/domains', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const result = await db.query(
      `SELECT id, user_id, domain, provider, provider_domain_id, status, verification_error,
              inbound_webhook_url, inbound_webhook_provider_id, inbound_webhook_status, inbound_webhook_error, inbound_webhook_synced_at,
              last_verified_at, dns_records_json, created_at, updated_at
       FROM sending_domains WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ domains: (result.rows || []).map(serializeDomainRow) });
  } catch (e) {
    console.error('[domain-email domains GET]', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

domainEmailRoutes.post('/domains', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const domain = normalizeDomainInput(req.body?.domain);
    const provider = String(req.body?.provider || '').trim().toLowerCase();
    const providerApiKey = String(req.body?.providerApiKey || '').trim();
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Enter a valid domain like example.com' });
    if (!DOMAIN_EMAIL_PROVIDERS.some((p) => p.id === provider)) return res.status(400).json({ error: 'Choose a valid provider' });

    const id = uuidv4();
    let dnsRecords = buildProviderDnsRecords(provider, domain);
    let providerDomainId = null;
    let status = 'pending';
    let verificationError = null;

    const setup = await createOrLocateProviderDomain({
      provider,
      domain,
      apiKey: providerApiKey,
    });
    if (setup?.ok) {
      if (setup.providerDomainId) providerDomainId = setup.providerDomainId;
      if (Array.isArray(setup.dnsRecords) && setup.dnsRecords.length) dnsRecords = setup.dnsRecords;
      if (setup.status === 'verified') status = 'verified';
    } else if (setup?.reason) {
      verificationError = setup.reason;
    }

    await db.query(
      `INSERT INTO sending_domains
       (id, user_id, domain, provider, provider_domain_id, status, dns_records_json, provider_api_key, verification_error, inbound_webhook_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW(), NOW())`,
      [id, req.user.id, domain, provider, providerDomainId, status, JSON.stringify(dnsRecords), providerApiKey || null, verificationError]
    );

    if (providerDomainId) {
      const rowForWebhook = {
        id,
        user_id: req.user.id,
        provider,
        provider_domain_id: providerDomainId,
        provider_api_key: providerApiKey || null,
      };
      await syncInboundWebhookForDomain(db, req, rowForWebhook);
    }
    logActivity('domain_email_domain_added', { domain, provider }, req.user.id);
    return res.status(201).json({
      domain: {
        id,
        domain,
        provider,
        status,
        dnsRecords,
      },
      info: 'Add these DNS records with your DNS host, then click Verify.',
    });
  } catch (e) {
    const msg = e?.message || 'Failed to add domain';
    if (String(msg).toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: 'This domain is already added for your account' });
    }
    console.error('[domain-email domains POST]', msg);
    return res.status(500).json({ error: 'Failed to add domain' });
  }
});

domainEmailRoutes.post('/domains/:domainId/verify', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const row = (
      await db.query(
        `SELECT id, user_id, domain, provider, provider_domain_id, provider_api_key
         FROM sending_domains WHERE id = $1 AND user_id = $2`,
        [req.params.domainId, req.user.id]
      )
    ).rows?.[0];
    if (!row) return res.status(404).json({ error: 'Domain not found' });

    const verified = await verifyDomainWithProvider({
      provider: row.provider,
      domain: row.domain,
      providerDomainId: row.provider_domain_id,
      apiKey: row.provider_api_key,
    });

    await db.query(
      `UPDATE sending_domains
       SET status = $1, provider_domain_id = COALESCE($2, provider_domain_id), verification_error = $3,
           dns_records_json = COALESCE($4, dns_records_json), last_verified_at = NOW(), updated_at = NOW()
       WHERE id = $5 AND user_id = $6`,
      [
        verified.verified ? 'verified' : 'pending',
        verified.providerDomainId || null,
        verified.reason || null,
        Array.isArray(verified.dnsRecords) && verified.dnsRecords.length ? JSON.stringify(verified.dnsRecords) : null,
        row.id,
        req.user.id,
      ]
    );

    let webhookSync = null;
    if (verified.providerDomainId || row.provider_domain_id) {
      webhookSync = await syncInboundWebhookForDomain(db, req, {
        ...row,
        provider_domain_id: verified.providerDomainId || row.provider_domain_id,
      });
    }

    logActivity('domain_email_domain_verify', { domain: row.domain, verified: !!verified.verified }, req.user.id);
    return res.json({
      ok: true,
      status: verified.verified ? 'verified' : 'pending',
      reason: verified.reason || null,
      webhook: webhookSync
        ? {
            configured: !!webhookSync.configured,
            manualRequired: !!webhookSync.manualRequired,
            reason: webhookSync.reason || null,
          }
        : null,
    });
  } catch (e) {
    console.error('[domain-email verify]', e?.message || e);
    return res.status(500).json({ error: 'Failed to verify domain' });
  }
});

domainEmailRoutes.post('/domains/:domainId/sync-provider', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const row = (
      await db.query(
        `SELECT id, user_id, domain, provider, provider_domain_id, provider_api_key
         FROM sending_domains WHERE id = $1 AND user_id = $2`,
        [req.params.domainId, req.user.id]
      )
    ).rows?.[0];
    if (!row) return res.status(404).json({ error: 'Domain not found' });

    const setup = await createOrLocateProviderDomain({
      provider: row.provider,
      domain: row.domain,
      apiKey: row.provider_api_key,
    });
    if (!setup?.ok) {
      await db.query(
        `UPDATE sending_domains SET verification_error = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [setup?.reason || 'Provider sync failed', row.id, req.user.id]
      );
      return res.status(400).json({ error: setup?.reason || 'Provider sync failed' });
    }

    await db.query(
      `UPDATE sending_domains
       SET provider_domain_id = COALESCE($1, provider_domain_id),
           dns_records_json = COALESCE($2, dns_records_json),
           verification_error = NULL,
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4`,
      [
        setup.providerDomainId || null,
        Array.isArray(setup.dnsRecords) && setup.dnsRecords.length ? JSON.stringify(setup.dnsRecords) : null,
        row.id,
        req.user.id,
      ]
    );

    await syncInboundWebhookForDomain(db, req, {
      ...row,
      provider_domain_id: setup.providerDomainId || row.provider_domain_id,
    });

    logActivity('domain_email_domain_sync', { domain: row.domain, provider: row.provider }, req.user.id);
    return res.json({ ok: true, providerDomainId: setup.providerDomainId || null });
  } catch (e) {
    console.error('[domain-email sync-provider]', e?.message || e);
    return res.status(500).json({ error: 'Failed to sync with provider' });
  }
});

domainEmailRoutes.delete('/domains/:domainId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const result = await db.query('DELETE FROM sending_domains WHERE id = $1 AND user_id = $2', [req.params.domainId, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Domain not found' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[domain-email delete domain]', e?.message || e);
    return res.status(500).json({ error: 'Failed to delete domain' });
  }
});

domainEmailRoutes.get('/senders', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const rows = await db.query(
      `SELECT s.id, s.from_name, s.from_email, s.domain_id, s.provider_identity_id, s.is_active, s.created_at,
              d.domain, d.provider, d.status AS domain_status
       FROM domain_sender_identities s
       JOIN sending_domains d ON d.id = s.domain_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.json({
      senders: (rows.rows || []).map((r) => ({
        id: r.id,
        fromName: r.from_name,
        fromEmail: r.from_email,
        domainId: r.domain_id,
        domain: r.domain,
        provider: r.provider,
        domainStatus: r.domain_status,
        providerIdentityId: r.provider_identity_id,
        isActive: r.is_active === 1,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error('[domain-email senders GET]', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch sender identities' });
  }
});

domainEmailRoutes.post('/senders', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const domainId = String(req.body?.domainId || '').trim();
    const fromName = String(req.body?.fromName || '').trim();
    const fromEmail = normalizeEmail(req.body?.fromEmail);
    if (!domainId) return res.status(400).json({ error: 'Domain is required' });
    if (!isValidEmail(fromEmail)) return res.status(400).json({ error: 'Enter a valid sender email' });

    const domainRow = (
      await db.query('SELECT id, domain, status FROM sending_domains WHERE id = $1 AND user_id = $2', [domainId, req.user.id])
    ).rows?.[0];
    if (!domainRow) return res.status(404).json({ error: 'Domain not found' });
    if (domainRow.status !== 'verified') return res.status(400).json({ error: 'Verify the domain before creating sender identities' });
    if (!fromEmail.endsWith(`@${domainRow.domain}`)) {
      return res.status(400).json({ error: `Sender email must belong to ${domainRow.domain}` });
    }

    const userId = req.user.id;
    const [countResult, limitResult] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM senders WHERE user_id = $1 AND is_active = 1', [userId]),
      getSenderLimitForUser(userId),
    ]);
    const count = parseInt(countResult.rows?.[0]?.c, 10) || 0;
    if (count >= limitResult.limit) {
      return res.status(403).json({
        error: 'Sender limit reached for your plan.',
        code: 'SENDER_LIMIT_REACHED',
        limit: limitResult.limit,
        count,
      });
    }

    const id = uuidv4();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO domain_sender_identities
         (id, user_id, domain_id, from_name, from_email, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, userId, domainId, fromName || null, fromEmail]
      );
      await client.query(
        `INSERT INTO senders (id, user_id, email, config, max_per_minute, is_active, provider, created_at)
         VALUES ($1, $2, $3, $4, 10, 1, 'domain', NOW())`,
        [
          id,
          userId,
          fromEmail,
          JSON.stringify({
            type: 'domain',
            domainSenderId: id,
          }),
        ]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    logActivity('domain_email_sender_added', { fromEmail, domainId }, req.user.id);
    return res.status(201).json({ sender: { id, fromName, fromEmail, domainId } });
  } catch (e) {
    const msg = e?.message || 'Failed to create sender identity';
    if (String(msg).toLowerCase().includes('duplicate')) return res.status(409).json({ error: 'This sender already exists' });
    console.error('[domain-email senders POST]', msg);
    return res.status(500).json({ error: 'Failed to create sender identity' });
  }
});

domainEmailRoutes.delete('/senders/:senderId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const client = await db.connect();
    let rowCount = 0;
    try {
      await client.query('BEGIN');
      const result = await client.query('DELETE FROM domain_sender_identities WHERE id = $1 AND user_id = $2', [req.params.senderId, req.user.id]);
      rowCount = result.rowCount;
      await client.query('UPDATE senders SET is_active = 0 WHERE id = $1 AND user_id = $2', [req.params.senderId, req.user.id]);
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
    if (!rowCount) return res.status(404).json({ error: 'Sender identity not found' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[domain-email senders DELETE]', e?.message || e);
    return res.status(500).json({ error: 'Failed to delete sender identity' });
  }
});

domainEmailRoutes.get('/campaigns', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const result = await db.query(
      `SELECT c.id, c.status, c.total_queued, c.sent, c.failed, c.subject, c.created_at,
              s.from_email, s.from_name, d.domain, d.provider
       FROM domain_campaigns c
       JOIN domain_sender_identities s ON s.id = c.sender_id
       JOIN sending_domains d ON d.id = c.domain_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    return res.json({
      campaigns: (result.rows || []).map((r) => ({
        id: r.id,
        status: r.status,
        totalQueued: r.total_queued,
        sent: r.sent,
        failed: r.failed,
        subject: r.subject,
        fromEmail: r.from_email,
        fromName: r.from_name,
        domain: r.domain,
        provider: r.provider,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error('[domain-email campaigns GET]', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch domain campaigns' });
  }
});

domainEmailRoutes.post('/campaigns/start', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
  try {
    const senderId = String(req.body?.senderId || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients.map(normalizeEmail).filter(Boolean) : [];
    if (!senderId) return res.status(400).json({ error: 'Select a sender identity' });
    if (!subject) return res.status(400).json({ error: 'Subject is required' });
    if (!body) return res.status(400).json({ error: 'Message body is required' });
    if (recipients.length === 0) return res.status(400).json({ error: 'Add at least one recipient' });

    const sender = (
      await db.query(
        `SELECT s.id, s.from_name, s.from_email, s.domain_id, d.provider, d.provider_api_key, d.status
         FROM domain_sender_identities s
         JOIN sending_domains d ON d.id = s.domain_id
         WHERE s.id = $1 AND s.user_id = $2`,
        [senderId, req.user.id]
      )
    ).rows?.[0];
    if (!sender) return res.status(404).json({ error: 'Sender identity not found' });
    if (sender.status !== 'verified') return res.status(400).json({ error: 'Domain is not verified yet' });

    const campaignId = uuidv4();
    await db.query(
      `INSERT INTO domain_campaigns
       (id, user_id, domain_id, sender_id, status, total_queued, sent, failed, subject, body, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'running', $5, 0, 0, $6, $7, NOW(), NOW())`,
      [campaignId, req.user.id, sender.domain_id, sender.id, recipients.length, subject, body]
    );

    let sent = 0;
    let failed = 0;
    for (const toEmail of recipients) {
      let status = 'sent';
      let providerMessageId = null;
      let error = null;
      let threadId = null;
      try {
        if (!isValidEmail(toEmail)) throw new Error('Invalid recipient email');
        const sendResult = await sendEmailViaProvider({
          provider: sender.provider,
          apiKey: sender.provider_api_key,
          fromName: sender.from_name,
          fromEmail: sender.from_email,
          toEmail,
          subject,
          textBody: body,
          replyTo: sender.from_email,
          metadata: { campaignId, senderId },
        });
        providerMessageId = sendResult?.messageId || null;
        threadId = await upsertThread(db, {
          userId: req.user.id,
          domainId: sender.domain_id,
          senderEmail: sender.from_email,
          contactEmail: toEmail,
          campaignId,
          subject,
        });
        await db.query(
          `INSERT INTO domain_inbox_messages
           (id, thread_id, user_id, campaign_id, direction, from_email, to_email, subject, body_text, provider_message_id, created_at)
           VALUES ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9, NOW())`,
          [uuidv4(), threadId, req.user.id, campaignId, sender.from_email, toEmail, subject, body, providerMessageId]
        );
        sent += 1;
      } catch (e) {
        status = 'failed';
        error = e?.message || 'Send failed';
        failed += 1;
      }

      await db.query(
        `INSERT INTO domain_campaign_sends
         (campaign_id, to_email, status, provider_message_id, error, thread_id, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [campaignId, toEmail, status, providerMessageId, error, threadId]
      );
    }

    const finalStatus = failed > 0 && sent === 0 ? 'failed' : 'completed';
    await db.query(
      `UPDATE domain_campaigns SET status = $1, sent = $2, failed = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5`,
      [finalStatus, sent, failed, campaignId, req.user.id]
    );
    logActivity('domain_email_campaign_start', { campaignId, totalQueued: recipients.length, sent, failed }, req.user.id);
    return res.json({ campaignId, status: finalStatus, totalQueued: recipients.length, sent, failed });
  } catch (e) {
    console.error('[domain-email campaigns start]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to start domain campaign' });
  }
});

domainEmailRoutes.get('/inbox/threads', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const result = await db.query(
      `SELECT t.id, t.sender_email, t.contact_email, t.subject, t.last_message_at, t.created_at, t.campaign_id, d.domain,
              (SELECT m.body_text FROM domain_inbox_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT m.direction FROM domain_inbox_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_direction
       FROM domain_inbox_threads t
       JOIN sending_domains d ON d.id = t.domain_id
       WHERE t.user_id = $1
       ORDER BY t.last_message_at DESC, t.updated_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    return res.json({
      threads: (result.rows || []).map((r) => ({
        id: r.id,
        senderEmail: r.sender_email,
        contactEmail: r.contact_email,
        subject: r.subject || '(No subject)',
        domain: r.domain,
        campaignId: r.campaign_id,
        lastBody: r.last_body || '',
        lastDirection: r.last_direction || '',
        lastMessageAt: r.last_message_at,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error('[domain-email inbox threads]', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch inbox threads' });
  }
});

domainEmailRoutes.get('/inbox/threads/:threadId/messages', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const allowed = await db.query('SELECT id FROM domain_inbox_threads WHERE id = $1 AND user_id = $2', [req.params.threadId, req.user.id]);
    if (!allowed.rows?.[0]) return res.status(404).json({ error: 'Thread not found' });
    const result = await db.query(
      `SELECT id, direction, from_email, to_email, subject, body_text, provider_message_id, in_reply_to, created_at
       FROM domain_inbox_messages
       WHERE thread_id = $1 AND user_id = $2
       ORDER BY created_at ASC
       LIMIT 500`,
      [req.params.threadId, req.user.id]
    );
    return res.json({
      messages: (result.rows || []).map((r) => ({
        id: r.id,
        direction: r.direction,
        fromEmail: r.from_email,
        toEmail: r.to_email,
        subject: r.subject,
        bodyText: r.body_text,
        providerMessageId: r.provider_message_id,
        inReplyTo: r.in_reply_to,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error('[domain-email inbox messages]', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch thread messages' });
  }
});

domainEmailRoutes.post('/inbox/threads/:threadId/reply', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const thread = (
      await db.query(
        `SELECT t.id, t.user_id, t.domain_id, t.sender_email, t.contact_email, t.subject, t.campaign_id, d.provider, d.provider_api_key
         FROM domain_inbox_threads t
         JOIN sending_domains d ON d.id = t.domain_id
         WHERE t.id = $1 AND t.user_id = $2`,
        [req.params.threadId, req.user.id]
      )
    ).rows?.[0];
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const body = String(req.body?.body || '').trim();
    const subject = ensureReplySubject(req.body?.subject || thread.subject || 'Re: Campaign response');
    if (!body) return res.status(400).json({ error: 'Reply body is required' });

    const recentMessages = (
      await db.query(
        'SELECT provider_message_id FROM domain_inbox_messages WHERE thread_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 10',
        [thread.id, req.user.id]
      )
    ).rows || [];
    const providerIds = recentMessages.map((m) => String(m.provider_message_id || '').trim()).filter(Boolean);
    const inReplyTo = providerIds[0] || undefined;
    const references = providerIds.length ? Array.from(new Set(providerIds.reverse())).join(' ') : undefined;

    const sendResult = await sendEmailViaProvider({
      provider: thread.provider,
      apiKey: thread.provider_api_key,
      fromName: null,
      fromEmail: thread.sender_email,
      toEmail: thread.contact_email,
      subject,
      textBody: body,
      replyTo: thread.sender_email,
      inReplyTo,
      references,
      metadata: thread.campaign_id ? { campaignId: thread.campaign_id } : undefined,
    });

    await db.query(
      `INSERT INTO domain_inbox_messages
       (id, thread_id, user_id, campaign_id, direction, from_email, to_email, subject, body_text, provider_message_id, in_reply_to, created_at)
       VALUES ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9, $10, NOW())`,
      [
        uuidv4(),
        thread.id,
        req.user.id,
        thread.campaign_id || null,
        thread.sender_email,
        thread.contact_email,
        subject,
        body,
        sendResult?.messageId || null,
        inReplyTo || null,
      ]
    );
    await db.query('UPDATE domain_inbox_threads SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2', [
      thread.id,
      req.user.id,
    ]);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[domain-email inbox reply]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to send reply' });
  }
});

domainEmailRoutes.post('/webhooks/:provider/:domainId', async (req, res) => {
  try {
    const secret = String(process.env.DOMAIN_EMAIL_WEBHOOK_SECRET || '').trim();
    if (secret) {
      const candidate = String(req.headers['x-domain-webhook-secret'] || '');
      if (!candidate || candidate !== secret) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for domain email sending' });
    const provider = String(req.params.provider || '').trim().toLowerCase();
    const domainRow = (
      await db.query(
        `SELECT id, user_id, domain, provider
         FROM sending_domains
         WHERE id = $1 AND provider = $2`,
        [req.params.domainId, provider]
      )
    ).rows?.[0];
    if (!domainRow) return res.status(404).json({ error: 'Domain not found for webhook path' });

    const payload = parseInboundPayload(provider, req.body);
    if (!payload.fromEmail || !payload.toEmail) return res.status(400).json({ error: 'Missing from/to in webhook payload' });
    if (!payload.toEmail.endsWith(`@${domainRow.domain}`)) return res.status(400).json({ error: 'Recipient does not belong to domain' });

    let campaignId = null;
    let threadId = null;
    const replyCandidates = extractMessageIdCandidates(payload.inReplyTo, payload.references);
    if (replyCandidates.length) {
      const linked = (
        await db.query(
          `SELECT campaign_id, thread_id
           FROM domain_inbox_messages
           WHERE user_id = $1
             AND provider_message_id IS NOT NULL
             AND lower(trim(both '<>' from provider_message_id)) = ANY($2::text[])
           ORDER BY created_at DESC
           LIMIT 1`,
          [domainRow.user_id, replyCandidates]
        )
      ).rows?.[0];
      campaignId = linked?.campaign_id || null;
      threadId = linked?.thread_id || null;
    }
    if (!threadId) {
      threadId = await upsertThread(db, {
        userId: domainRow.user_id,
        domainId: domainRow.id,
        senderEmail: payload.toEmail,
        contactEmail: payload.fromEmail,
        campaignId,
        subject: payload.subject || null,
      });
    }

    await db.query(
      `INSERT INTO domain_inbox_messages
       (id, thread_id, user_id, campaign_id, direction, from_email, to_email, subject, body_text, provider_message_id, in_reply_to, created_at)
       VALUES ($1, $2, $3, $4, 'inbound', $5, $6, $7, $8, $9, $10, NOW())`,
      [
        uuidv4(),
        threadId,
        domainRow.user_id,
        campaignId,
        payload.fromEmail,
        payload.toEmail,
        payload.subject || null,
        payload.text || '',
        String(payload.messageId || '').trim() || null,
        String(payload.inReplyTo || '').trim() || null,
      ]
    );
    logActivity('domain_email_inbound_reply', { threadId, domainId: domainRow.id, campaignId }, domainRow.user_id);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[domain-email webhook inbound]', e?.message || e);
    return res.status(500).json({ error: 'Failed to process inbound webhook' });
  }
});
