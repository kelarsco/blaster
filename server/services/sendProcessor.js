import nodemailer from 'nodemailer';
import { getDb } from '../db.js';
import { sendEmailViaProvider } from './domainEmailProviders.js';

const transporterCache = new Map();
const senderQueue = new Map();
const lastSendTime = new Map();

function normalizedSmtpHost(config = {}) {
  return String(config.host || 'smtp.gmail.com').trim().toLowerCase();
}

function normalizedSmtpPort(config = {}) {
  const p = Number(config.port);
  if (Number.isFinite(p) && p > 0) return p;
  const host = normalizedSmtpHost(config);
  return (host === 'smtp.gmail.com' || host === 'smtp-relay.gmail.com') ? 465 : 587;
}

function getTransporter(senderId, config, auth) {
  let t = transporterCache.get(senderId);
  if (t) return t;
  const port = normalizedSmtpPort(config);
  const requireTLS = port === 587 || !!config?.requireTLS;
  const tlsOptions = requireTLS ? { minVersion: 'TLSv1.2' } : undefined;
  t = nodemailer.createTransport({
    host: normalizedSmtpHost(config),
    port,
    secure: port === 465,
    requireTLS,
    tls: tlsOptions,
    auth,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 25000,
    greetingTimeout: 15000,
  });
  transporterCache.set(senderId, t);
  return t;
}

/** Clear cached transporter so next send gets a fresh connection (e.g. after timeout). */
function clearTransporter(senderId) {
  const t = transporterCache.get(senderId);
  if (t && t.close) {
    try {
      // Nodemailer transporters expose a synchronous close in most setups.
      // If it ever returns a Promise, we ignore rejections.
      const maybePromise = t.close();
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => {});
      }
    } catch (_) {
      // ignore close errors – we just want to drop the cached transport
    }
  }
  transporterCache.delete(senderId);
}

async function tryGmailSslFallbackSend(config, auth, mailOptions) {
  const fallbackTransporter = nodemailer.createTransport({
    host: normalizedSmtpHost(config),
    port: 465,
    secure: true,
    auth,
    pool: false,
    connectionTimeout: 25000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  try {
    await fallbackTransporter.sendMail(mailOptions);
  } finally {
    try {
      fallbackTransporter.close();
    } catch (_) {
      // Ignore close errors from one-off fallback transport.
    }
  }
}

const MIN_SEND_INTERVAL_MS = 10000; // 10 sec minimum between sends; users can set higher in campaign options

async function withSenderSerialization(senderId, maxPerMinute, fn) {
  const prev = senderQueue.get(senderId) || Promise.resolve();
  const run = async () => {
    const now = Date.now();
    const last = lastSendTime.get(senderId) || 0;
    const userInterval = maxPerMinute > 0 ? Math.ceil(60000 / maxPerMinute) : MIN_SEND_INTERVAL_MS;
    const minInterval = Math.max(MIN_SEND_INTERVAL_MS, userInterval);
    const wait = Math.max(0, minInterval - (now - last));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      await fn();
    } finally {
      lastSendTime.set(senderId, Date.now());
    }
  };
  const next = prev.then(() => run(), () => run());
  senderQueue.set(senderId, next);
  return next;
}

async function upsertDomainThread(db, { userId, domainId, senderEmail, contactEmail, campaignId, subject }) {
  const threadId = `thr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
    [threadId, userId, domainId, String(senderEmail || '').toLowerCase(), String(contactEmail || '').toLowerCase(), campaignId || null, subject || null]
  );
  return result.rows?.[0]?.id || threadId;
}

async function storeDomainOutboundMessage(db, {
  userId,
  campaignId,
  domainId,
  senderEmail,
  contactEmail,
  subject,
  body,
  providerMessageId,
}) {
  const threadId = await upsertDomainThread(db, {
    userId,
    domainId,
    senderEmail,
    contactEmail,
    campaignId,
    subject,
  });
  await db.query(
    `INSERT INTO domain_inbox_messages
     (id, thread_id, user_id, campaign_id, direction, from_email, to_email, subject, body_text, provider_message_id, created_at)
     VALUES ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9, NOW())`,
    [
      `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      threadId,
      userId,
      campaignId || null,
      String(senderEmail || '').toLowerCase(),
      String(contactEmail || '').toLowerCase(),
      subject || '',
      body || '',
      providerMessageId || null,
    ]
  );
}

async function resolveDomainCampaignId(db, campaignId, userId) {
  if (!campaignId) return null;
  const result = await db.query(
    'SELECT id FROM domain_campaigns WHERE id = $1 AND user_id = $2 LIMIT 1',
    [campaignId, userId]
  );
  return result.rows?.[0]?.id || null;
}

export async function processSendEmail(payload) {
  const { campaignId, storeUrl, email, senderId, subject, body } = payload;
  const db = getDb();
  if (!db) return;
  const statusRow = await db.query('SELECT status FROM campaigns WHERE id = $1', [campaignId]);
  if (!statusRow.rows[0] || statusRow.rows[0].status !== 'running') return;
  const senderResult = await db.query('SELECT * FROM senders WHERE id = $1', [senderId]);
  const senderRow = senderResult.rows[0];
  if (!senderRow) {
    console.error('[send] Sender not found:', senderId, '– Add the sender again in Automation Setup (with DB running).');
    await safeInsertCampaignSend(db, campaignId, storeUrl, email, null, 'failed', 'Sender not found');
    return;
  }

  let config;
  try {
    config = JSON.parse(senderRow.config || '{}');
  } catch {
    config = {};
  }
  const auth = config.auth && (config.auth.user || config.auth.pass)
    ? { user: config.auth.user, pass: config.auth.pass }
    : undefined;

  const storeDomain = (() => {
    try {
      return new URL(storeUrl).hostname;
    } catch {
      return storeUrl;
    }
  })();
  const finalBody = (body || '')
    .replace(/\{\{store_url\}\}/g, storeUrl)
    .replace(/\{\{store_domain\}\}/g, storeDomain);
  const finalSubject = (subject || storeUrl).replace(/\{\{store_url\}\}/g, storeUrl).replace(/\{\{store_domain\}\}/g, storeDomain);

  const maxPerMinute = Math.max(1, Math.min(60, Number(senderRow.max_per_minute) || 10));

  if ((senderRow.provider || '').toLowerCase() === 'domain') {
    const doDomainSend = async () => {
      const domainSenderId = config?.domainSenderId || senderRow.id;
      const domainSender = (
        await db.query(
          `SELECT s.id, s.domain_id, s.from_name, s.from_email, d.provider, d.provider_api_key
           FROM domain_sender_identities s
           JOIN sending_domains d ON d.id = s.domain_id
           WHERE s.id = $1`,
          [domainSenderId]
        )
      ).rows?.[0];
      if (!domainSender) {
        await safeInsertCampaignSend(db, campaignId, storeUrl, email, senderRow.email, 'failed', 'Domain sender identity not found');
        return;
      }
      const sendResult = await sendEmailViaProvider({
        provider: domainSender.provider,
        apiKey: domainSender.provider_api_key,
        fromName: domainSender.from_name,
        fromEmail: domainSender.from_email,
        toEmail: email,
        subject: finalSubject,
        textBody: finalBody,
        replyTo: domainSender.from_email,
        metadata: { campaignId, senderId: senderRow.id },
      });
      // Store in domain inbox so inbound replies can be threaded and visible.
      try {
        // Domain inbox thread/message campaign_id must reference domain_campaigns.
        // Background sends may come from the regular campaigns table, so guard FK.
        const domainCampaignId = await resolveDomainCampaignId(db, campaignId, senderRow.user_id);
        await storeDomainOutboundMessage(db, {
          userId: senderRow.user_id,
          campaignId: domainCampaignId,
          domainId: domainSender.domain_id,
          senderEmail: domainSender.from_email,
          contactEmail: email,
          subject: finalSubject,
          body: finalBody,
          providerMessageId: sendResult?.messageId || null,
        });
      } catch (threadErr) {
        console.warn('[send] domain outbound message storage failed:', threadErr?.message || threadErr);
      }
      const inserted = await safeInsertCampaignSend(db, campaignId, storeUrl, email, senderRow.email, 'sent');
      if (inserted) await updateCampaignCounts(db, campaignId, 'sent');
    };

    try {
      await withSenderSerialization(senderId, maxPerMinute, doDomainSend);
    } catch (err) {
      const errMsg = err.message || String(err);
      const inserted = await safeInsertCampaignSend(db, campaignId, storeUrl, email, senderRow.email, 'failed', errMsg);
      if (inserted) await updateCampaignCounts(db, campaignId, 'failed');
    }
    return;
  }

  if (!auth || !auth.user || !auth.pass) {
    console.error('[send] Sender has no SMTP user/password. Edit the sender in Automation Setup and fill SMTP user + App Password.');
    await safeInsertCampaignSend(db, campaignId, storeUrl, email, senderRow.email, 'failed', 'Sender missing SMTP user/password');
    return;
  }

  const transporter = getTransporter(senderId, config, auth);

  const doSend = async () => {
    const mailOptions = {
      from: senderRow.email,
      to: email,
      subject: finalSubject,
      text: finalBody,
    };
    try {
      await transporter.sendMail(mailOptions);
    } catch (sendErr) {
      const errMsg = String(sendErr?.message || sendErr || '');
      const host = normalizedSmtpHost(config);
      const port = normalizedSmtpPort(config);
      const isTimeout = /ETIMEDOUT|timeout/i.test(errMsg);
      const isGmail587 = (host === 'smtp.gmail.com' || host === 'smtp-relay.gmail.com') && port === 587;
      if (isTimeout && isGmail587) {
        // Common on restricted networks: STARTTLS on 587 times out; retry with implicit TLS 465.
        clearTransporter(senderId);
        await tryGmailSslFallbackSend(config, auth, mailOptions);
      } else {
        throw sendErr;
      }
    }
    const inserted = await safeInsertCampaignSend(db, campaignId, storeUrl, email, senderRow.email, 'sent');
    if (inserted) await updateCampaignCounts(db, campaignId, 'sent');
  };

  try {
    await withSenderSerialization(senderId, maxPerMinute, doSend);
  } catch (err) {
    const errMsg = err.message || String(err);
    const isConnectionError = /timeout|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection/i.test(errMsg);
    if (isConnectionError) clearTransporter(senderId);
    console.error('[send] SMTP error:', errMsg, '| to:', email, '| from:', senderRow.email);
    const inserted = await safeInsertCampaignSend(db, campaignId, storeUrl, email, senderRow.email, 'failed', errMsg);
    if (inserted) await updateCampaignCounts(db, campaignId, 'failed');
  }
}

async function safeInsertCampaignSend(db, campaignId, storeUrl, email, senderEmail, status, error = null) {
  try {
    if (error != null) {
      await db.query(
        `INSERT INTO campaign_sends (campaign_id, store_url, email, status, sender_email, error, sent_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [campaignId, storeUrl, email, status, senderEmail, error]
      );
    } else {
      await db.query(
        `INSERT INTO campaign_sends (campaign_id, store_url, email, status, sender_email, sent_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [campaignId, storeUrl, email, status, senderEmail]
      );
    }
    return true;
  } catch (err) {
    if (err.code === '23503' || (err.message && err.message.includes('foreign key constraint'))) {
      return false;
    }
    throw err;
  }
}

async function updateCampaignCounts(db, campaignId, type) {
  const result = await db.query('SELECT sent, failed, total_queued FROM campaigns WHERE id = $1', [campaignId]);
  const row = result.rows[0];
  if (!row) return;
  if (type === 'sent') {
    await db.query('UPDATE campaigns SET sent = sent + 1, updated_at = NOW() WHERE id = $1', [campaignId]);
  } else {
    await db.query('UPDATE campaigns SET failed = failed + 1, updated_at = NOW() WHERE id = $1', [campaignId]);
  }
  const nextSent = type === 'sent' ? (row.sent || 0) + 1 : (row.sent || 0);
  const nextFailed = type === 'failed' ? (row.failed || 0) + 1 : (row.failed || 0);
  const total = row.total_queued || 0;
  if (total > 0 && nextSent + nextFailed >= total) {
    await db.query("UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1", [campaignId]);
  }
}
