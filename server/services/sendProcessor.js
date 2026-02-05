import nodemailer from 'nodemailer';
import { getDb } from '../db.js';

export async function processSendEmail(payload) {
  const { campaignId, storeUrl, email, senderId, subject, body } = payload;
  const db = getDb();
  if (!db) return;
  const statusRow = await db.query('SELECT status FROM campaigns WHERE id = $1', [campaignId]);
  if (statusRow.rows[0] && statusRow.rows[0].status !== 'running') return;
  const senderResult = await db.query('SELECT * FROM senders WHERE id = $1', [senderId]);
  const senderRow = senderResult.rows[0];
  if (!senderRow) {
    console.error('[send] Sender not found:', senderId, '– Add the sender again in Automation Setup (with DB running).');
    await db.query(
      `INSERT INTO campaign_sends (campaign_id, store_url, email, status, error) VALUES ($1, $2, $3, 'failed', $4)`,
      [campaignId, storeUrl, email, 'Sender not found']
    );
    await updateCampaignCounts(db, campaignId, 'failed');
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
    await db.query(
      `INSERT INTO campaign_sends (campaign_id, store_url, email, status, error) VALUES ($1, $2, $3, 'failed', $4)`,
      [campaignId, storeUrl, email, 'Sender missing SMTP user/password']
    );
    await updateCampaignCounts(db, campaignId, 'failed');
    return;
  }
  const port = Number(config.port) || 587;
  const transporter = nodemailer.createTransport({
    host: config.host || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth,
  });

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

  try {
    await transporter.sendMail({
      from: senderRow.email,
      to: email,
      subject: finalSubject,
      text: finalBody,
    });
    await db.query(
      `INSERT INTO campaign_sends (campaign_id, store_url, email, status, sender_email, sent_at) VALUES ($1, $2, $3, 'sent', $4, NOW())`,
      [campaignId, storeUrl, email, senderRow.email]
    );
    await updateCampaignCounts(db, campaignId, 'sent');
  } catch (err) {
    const errMsg = err.message || String(err);
    console.error('[send] SMTP error:', errMsg, '| to:', email, '| from:', senderRow.email);
    await db.query(
      `INSERT INTO campaign_sends (campaign_id, store_url, email, status, sender_email, error, sent_at) VALUES ($1, $2, $3, 'failed', $4, $5, NOW())`,
      [campaignId, storeUrl, email, senderRow.email, errMsg]
    );
    await updateCampaignCounts(db, campaignId, 'failed');
  }
}

async function updateCampaignCounts(db, campaignId, type) {
  const result = await db.query('SELECT sent, failed FROM campaigns WHERE id = $1', [campaignId]);
  const row = result.rows[0];
  if (!row) return;
  if (type === 'sent') {
    await db.query('UPDATE campaigns SET sent = sent + 1, updated_at = NOW() WHERE id = $1', [campaignId]);
  } else {
    await db.query('UPDATE campaigns SET failed = failed + 1, updated_at = NOW() WHERE id = $1', [campaignId]);
  }
}
