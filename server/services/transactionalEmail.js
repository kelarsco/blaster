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

const FROM_EMAIL = process.env.VERIFICATION_EMAIL_FROM || process.env.INVITE_EMAIL_FROM || process.env.INVITE_SMTP_USER || 'onboarding@resend.dev';
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
