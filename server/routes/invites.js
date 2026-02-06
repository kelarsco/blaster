import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { getDb } from '../db.js';

const hasInviteSmtp =
  process.env.INVITE_SMTP_HOST &&
  process.env.INVITE_SMTP_USER &&
  process.env.INVITE_SMTP_PASS;

let inviteTransporter = null;
if (hasInviteSmtp) {
  inviteTransporter = nodemailer.createTransport({
    host: process.env.INVITE_SMTP_HOST,
    port: Number(process.env.INVITE_SMTP_PORT) || 587,
    secure: process.env.INVITE_SMTP_PORT === '465',
    auth: {
      user: process.env.INVITE_SMTP_USER,
      pass: process.env.INVITE_SMTP_PASS,
    },
  });
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  next();
}

export const inviteRoutes = Router();

/** Create invite and send email with login link */
inviteRoutes.post('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const { email } = req.body || {};
    const inviteeEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!inviteeEmail) return res.status(400).json({ error: 'Email is required' });

    const inviterId = req.user.id;
    const inviterEmail = req.user.email || '';
    const inviterName = req.user.name || inviterEmail.split('@')[0] || 'A teammate';

    // Check if already a team member or invited
    const existing = await db.query(
      `SELECT 1 FROM team_members WHERE owner_id = $1 AND member_email = $2
       UNION
       SELECT 1 FROM invites WHERE inviter_id = $1 AND invitee_email = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
      [inviterId, inviteeEmail]
    );
    if (existing.rows?.length) {
      return res.status(409).json({ error: 'This user is already on your team or has a pending invite' });
    }

    const token = uuidv4();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.query(
      `INSERT INTO invites (id, inviter_id, inviter_email, invitee_email, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, inviterId, inviterEmail, inviteeEmail, token, expiresAt]
    );

    const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000';
    const acceptUrl = `${baseUrl.replace(/\/$/, '')}/invite/accept?token=${token}`;

    if (hasInviteSmtp && inviteTransporter) {
      const from = process.env.INVITE_EMAIL_FROM || process.env.INVITE_SMTP_USER || 'noreply@wiblaster.com';
      await inviteTransporter.sendMail({
        from,
        to: inviteeEmail,
        subject: `${inviterName} invited you to join wiblaster`,
        html: `
          <p>Hi,</p>
          <p><strong>${inviterName}</strong> has invited you to collaborate on wiblaster. You'll get access to all features they're eligible for.</p>
          <p><a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a21;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;">Sign in with Google to join</a></p>
          <p>Or copy this link: ${acceptUrl}</p>
          <p>This link expires in 7 days.</p>
          <p>— The wiblaster team</p>
        `,
      });
    }

    return res.status(201).json({
      ok: true,
      message: hasInviteSmtp ? 'Invite sent' : 'Invite created',
      ...(!hasInviteSmtp && { inviteLink: acceptUrl }),
    });
  } catch (e) {
    console.error('[invites]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to send invite' });
  }
});

/** Get invite by token (for accept page) */
inviteRoutes.get('/token/:token', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const { token } = req.params;
    const r = await db.query(
      'SELECT invitee_email, inviter_email as inviter_name FROM invites WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()',
      [token]
    );
    const row = r?.rows?.[0];
    if (!row) return res.status(404).json({ error: 'Invite not found or expired' });
    return res.json({ inviteeEmail: row.invitee_email, inviterName: row.inviter_name });
  } catch (e) {
    console.error('[invites token]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to load invite' });
  }
});

/** Redeem invite after user has signed in (links them to team) */
inviteRoutes.post('/accept', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const r = await db.query(
      'SELECT id, inviter_id, inviter_email, invitee_email FROM invites WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()',
      [token]
    );
    const row = r?.rows?.[0];
    if (!row) return res.status(404).json({ error: 'Invite not found or expired' });

    // Ensure the signed-in user matches the invitee email (Google login)
    const userEmail = (req.user.email || '').toLowerCase();
    if (userEmail !== row.invitee_email.toLowerCase()) {
      return res.status(403).json({ error: 'Please sign in with the email address that received the invite' });
    }

    await db.query('UPDATE invites SET accepted_at = NOW() WHERE id = $1', [row.id]);

    const teamId = uuidv4();
    await db.query(
      'INSERT INTO team_members (id, owner_id, member_id, member_email) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [teamId, row.inviter_id, req.user.id, userEmail]
    );

    return res.json({ ok: true, message: 'You have joined the team' });
  } catch (e) {
    console.error('[invites accept]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to accept invite' });
  }
});

/** List pending invites and team members */
inviteRoutes.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ invites: [], members: [] });

    const ownerId = req.user.id;
    const [invitesRes, membersRes] = await Promise.all([
      db.query(
        'SELECT invitee_email, created_at FROM invites WHERE inviter_id = $1 AND accepted_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC',
        [ownerId]
      ),
      db.query(
        'SELECT member_email, member_id, invited_at FROM team_members WHERE owner_id = $1 ORDER BY invited_at DESC',
        [ownerId]
      ),
    ]);

    return res.json({
      invites: invitesRes.rows || [],
      members: membersRes.rows || [],
    });
  } catch (e) {
    console.error('[invites list]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to load invites' });
  }
});
