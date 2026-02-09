/**
 * Send email via Gmail API (users.messages.send). Refreshes access token when expired.
 * On quota or auth errors, updates sender oauth_status so campaign can skip or rotate.
 */
import { getDb } from '../db.js';

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

/** Refresh Google OAuth access token. Returns { access_token } or throws. */
export async function refreshGmailAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Token refresh failed');
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in refresh response');
  return { accessToken: data.access_token };
}

/** Get a valid access token for the sender: use stored one or refresh. Updates DB with new token if refreshed. */
export async function getValidAccessToken(senderId, accessToken, refreshToken) {
  if (!refreshToken) return accessToken;
  // Optional: quick check if current token is still valid (we could decode JWT exp, but Google's tokens are opaque)
  // So we try send first; on 401 we refresh and retry (handled in sendEmailViaGmail). Here we just return current.
  return accessToken;
}

/** Build a simple MIME message (plain text) and return base64url-encoded raw for Gmail API. */
function buildRawMessage(from, to, subject, textBody) {
  const lines = [
    'From: ' + from,
    'To: ' + to,
    'Subject: ' + subject,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    textBody || '',
  ];
  const raw = lines.join('\r\n');
  return Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Send one email via Gmail API. Uses sender's access_token; if 401, refreshes and updates DB then retries once.
 * On success returns undefined. On quota/revoke errors, updates sender oauth_status and throws.
 */
export async function sendEmailViaGmail(senderId, fromEmail, accessToken, refreshToken, to, subject, textBody) {
  const db = getDb();
  let token = accessToken;

  const doSend = async (accessTokenToUse) => {
    const raw = buildRawMessage(fromEmail, to, subject, textBody || '');
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessTokenToUse,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (res.status === 401 && refreshToken && db) {
      try {
        const { accessToken: newToken } = await refreshGmailAccessToken(refreshToken);
        await db.query('UPDATE senders SET oauth_access_token = $1 WHERE id = $2', [newToken, senderId]);
        return doSend(newToken);
      } catch (refreshErr) {
        await db.query(
          "UPDATE senders SET oauth_status = 'reconnect_needed' WHERE id = $1",
          [senderId]
        ).catch(() => {});
        throw new Error('Gmail access expired. Reconnect this inbox in Senders.');
      }
    }

    if (res.status === 403 || res.status === 429) {
      const errText = await res.text();
      // Only treat as daily limit when clearly quota/rate (429 or explicit quota wording). Unverified app / access denied 403 often contains "limit" but is not a send quota.
      const isQuota = res.status === 429 || /quota exceeded|rate limit|daily limit|user rate limit|resource has been exhausted/i.test(errText);
      const isAccessBlocked = /access denied|blocked|verification|verified this app|forbidden|restricted/i.test(errText);
      if (db) {
        if (isQuota) {
          await db.query(
            "UPDATE senders SET oauth_status = 'daily_limit_reached' WHERE id = $1",
            [senderId]
          ).catch(() => {});
        } else if (isAccessBlocked || res.status === 403) {
          await db.query(
            "UPDATE senders SET oauth_status = 'reconnect_needed' WHERE id = $1",
            [senderId]
          ).catch(() => {});
        }
      }
      throw new Error(isQuota ? 'Gmail daily send limit reached for this account.' : 'Gmail access blocked. If you see "app not verified", add this account as a test user in Google Cloud Console or verify the app. Reconnect this inbox in Senders.');
    }

    if (!res.ok) {
      const errText = await res.text();
      if (/revoked|invalid|access denied|blocked|verification/i.test(errText) && db) {
        await db.query(
          "UPDATE senders SET oauth_status = 'reconnect_needed' WHERE id = $1",
          [senderId]
        ).catch(() => {});
      }
      throw new Error(errText || 'Gmail API error');
    }
  };

  await doSend(token);
}
