import nodemailer from 'nodemailer';
import { getDb } from '../db.js';

const transporterCache = new Map();
const senderQueue = new Map();
const lastSendTime = new Map();

function getTransporter(senderId, config, auth) {
  let t = transporterCache.get(senderId);
  if (t) return t;
  const port = Number(config.port) || 587;
  t = nodemailer.createTransport({
    host: config.host || 'smtp.gmail.com',
    port,
    secure: port === 465,
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
  if (!auth || !auth.user || !auth.pass) {
    console.error('[send] Sender has no SMTP user/password. Edit the sender in Automation Setup and fill SMTP user + App Password.');
    await safeInsertCampaignSend(db, campaignId, storeUrl, email, senderRow.email, 'failed', 'Sender missing SMTP user/password');
    return;
  }

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
  const transporter = getTransporter(senderId, config, auth);

  const doSend = async () => {
    await transporter.sendMail({
      from: senderRow.email,
      to: email,
      subject: finalSubject,
      text: finalBody,
    });
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
