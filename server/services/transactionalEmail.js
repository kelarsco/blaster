/**
 * Transactional emails via Resend: account deactivated, subscription confirmed, invite accepted.
 * Uses RESEND_API_KEY (same as verification/password reset). No email sent if key is missing.
 */
import { Resend } from 'resend';

const hasResend = Boolean(process.env.RESEND_API_KEY);
let resendClient = null;
if (hasResend) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

const FROM_EMAIL = process.env.VERIFICATION_EMAIL_FROM || process.env.INVITE_EMAIL_FROM || process.env.INVITE_SMTP_USER || 'no-reply@wiblaster.com';
const FROM_NAME = process.env.VERIFICATION_EMAIL_FROM_NAME || 'wiblaster';

function getFrom() {
  return FROM_EMAIL.includes('@') ? `${FROM_NAME} <${FROM_EMAIL}>` : FROM_EMAIL;
}

/**
 * Send confirmation when user deactivates their account.
 */
export async function sendDeactivationConfirmation(toEmail, userName = '') {
  if (!resendClient) return { skipped: true };
  const name = userName || toEmail?.split('@')[0] || 'there';
  const subject = 'Your wiblaster account has been deactivated';
  const html = `
    <p>Hi${name !== 'there' ? ` ${name}` : ''},</p>
    <p>This is to confirm that your wiblaster account has been deactivated as requested.</p>
    <p>Your data is retained. If you change your mind, contact support to reactivate your account.</p>
    <p>— wiblaster</p>
  `;
  const { data, error } = await resendClient.emails.send({
    from: getFrom(),
    to: toEmail,
    subject,
    html,
  });
  if (error) throw new Error(error.message || 'Failed to send email');
  return { ok: true, id: data?.id };
}

/**
 * Send confirmation when user successfully subscribes to a plan.
 */
export async function sendSubscriptionConfirmation(toEmail, planName, amountFormatted, interval = 'monthly') {
  if (!resendClient) return { skipped: true };
  const intervalLabel = interval === 'annually' ? 'year' : 'month';
  const subject = `You're now on ${planName} – wiblaster`;
  const html = `
    <p>Hi,</p>
    <p>Thanks for subscribing. Your wiblaster account is now on the <strong>${planName}</strong> plan.</p>
    <p>Amount: ${amountFormatted} per ${intervalLabel}.</p>
    <p>You can manage your plan and billing from your account settings.</p>
    <p>— wiblaster</p>
  `;
  const { data, error } = await resendClient.emails.send({
    from: getFrom(),
    to: toEmail,
    subject,
    html,
  });
  if (error) throw new Error(error.message || 'Failed to send email');
  return { ok: true, id: data?.id };
}

/**
 * Notify the inviter when someone accepts their invite and joins the team.
 */
export async function sendInviteAcceptedNotification(toInviterEmail, inviteeEmail) {
  if (!resendClient) return { skipped: true };
  const subject = `${inviteeEmail} joined your team – wiblaster`;
  const html = `
    <p>Hi,</p>
    <p><strong>${inviteeEmail}</strong> has accepted your invite and joined your wiblaster team.</p>
    <p>You can manage team members from your account.</p>
    <p>— wiblaster</p>
  `;
  const { data, error } = await resendClient.emails.send({
    from: getFrom(),
    to: toInviterEmail,
    subject,
    html,
  });
  if (error) throw new Error(error.message || 'Failed to send email');
  return { ok: true, id: data?.id };
}

export function isTransactionalEmailConfigured() {
  return hasResend;
}

const STREAK_EMAIL_THEMES = {
  3: {
    emoji: '✨',
    headline: '3 days strong',
    accent: '#6366f1',
    accentLight: '#eef2ff',
    message:
      "Celebrate your small wins — you've hit a 3-day streak! Keep up the great work. You're one step closer to landing your next client. Every email you send is a door you're knocking on.",
  },
  7: {
    emoji: '🔥',
    headline: '7-day streak unlocked',
    accent: '#f97316',
    accentLight: '#fff7ed',
    message:
      "A full week of consistency — that's momentum worth celebrating. Your 7-day streak shows real commitment. Keep showing up; your next reply could be one send away.",
  },
  14: {
    emoji: '🔥🔥',
    headline: '14 days on fire',
    accent: '#ea580c',
    accentLight: '#ffedd5',
    message:
      "Two weeks straight — you're building a habit that compounds. Your 14-day streak is proof you're serious about outreach. Stay the course; great things stack up day by day.",
  },
  30: {
    emoji: '🏆',
    headline: '30-day champion',
    accent: '#7c3aed',
    accentLight: '#f5f3ff',
    message:
      "A full month of daily discipline — incredible work. Your 30-day streak puts you in rare company. You've earned this milestone. Keep knocking on those doors.",
  },
};

/**
 * Send celebration email when a streak badge milestone is earned (3, 7, 14, or 30 days).
 */
export async function sendStreakBadgeCelebration(toEmail, userName = '', streakDays, currentStreak = streakDays) {
  if (!resendClient) return { skipped: true };
  const theme = STREAK_EMAIL_THEMES[streakDays];
  if (!theme) return { skipped: true };

  const name = userName || toEmail?.split('@')[0] || 'there';
  const subject = `${theme.emoji} You earned a ${streakDays}-day streak — wiblaster`;
  const html = `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: linear-gradient(135deg, ${theme.accent} 0%, #fcb04c 100%); border-radius: 16px 16px 0 0; padding: 28px 24px; text-align: center;">
        <div style="font-size: 40px; line-height: 1; margin-bottom: 8px;">${theme.emoji}</div>
        <h1 style="margin: 0; color: #fff; font-size: 22px; font-weight: 700;">${theme.headline}</h1>
      </div>
      <div style="background: ${theme.accentLight}; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.65; color: #374151;">${theme.message}</p>
        <p style="margin: 0; padding: 14px 16px; background: #fff; border-radius: 12px; border: 1px solid #e5e5e5; font-size: 14px; color: #6b7280;">
          Current streak: <strong style="color: ${theme.accent};">${currentStreak} day${currentStreak === 1 ? '' : 's'}</strong>
        </p>
      </div>
      <p style="margin: 20px 0 0; font-size: 13px; color: #9ca3af; text-align: center;">— wiblaster</p>
    </div>
  `;
  const { data, error } = await resendClient.emails.send({
    from: getFrom(),
    to: toEmail,
    subject,
    html,
  });
  if (error) throw new Error(error.message || 'Failed to send email');
  return { ok: true, id: data?.id };
}
