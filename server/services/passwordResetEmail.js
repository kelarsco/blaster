/**
 * Send password reset email via Resend or SMTP.
 */
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const hasResend = Boolean(process.env.RESEND_API_KEY);
const hasSmtp =
  process.env.INVITE_SMTP_HOST &&
  process.env.INVITE_SMTP_USER &&
  process.env.INVITE_SMTP_PASS;

let resendClient = null;
let smtpTransporter = null;

if (hasResend) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
}
if (hasSmtp) {
  smtpTransporter = nodemailer.createTransport({
    host: process.env.INVITE_SMTP_HOST,
    port: Number(process.env.INVITE_SMTP_PORT) || 587,
    secure: process.env.INVITE_SMTP_PORT === '465',
    auth: {
      user: process.env.INVITE_SMTP_USER,
      pass: process.env.INVITE_SMTP_PASS,
    },
  });
}

const FROM_EMAIL = process.env.VERIFICATION_EMAIL_FROM || process.env.INVITE_EMAIL_FROM || process.env.INVITE_SMTP_USER || 'onboarding@resend.dev';
const FROM_NAME = process.env.VERIFICATION_EMAIL_FROM_NAME || 'wiblaster';

export async function sendPasswordResetEmail(toEmail, resetLink) {
  const subject = 'Reset your wiblaster password';
  const html = `
    <p>Hi,</p>
    <p>You requested a password reset for your wiblaster account. Click the link below to set a new password:</p>
    <p><a href="${resetLink}" style="color:#6366f1;font-weight:600;">Reset password</a></p>
    <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    <p>— wiblaster</p>
  `;

  if (resendClient) {
    const from = FROM_EMAIL.includes('@') ? `${FROM_NAME} <${FROM_EMAIL}>` : FROM_EMAIL;
    const { data, error } = await resendClient.emails.send({
      from,
      to: toEmail,
      subject,
      html,
    });
    if (error) throw new Error(error.message || 'Failed to send email');
    return { ok: true, id: data?.id };
  }

  if (smtpTransporter) {
    await smtpTransporter.sendMail({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html,
    });
    return { ok: true };
  }

  throw new Error('Email not configured. Set RESEND_API_KEY or INVITE_SMTP_* in server/.env');
}

export function isPasswordResetEmailConfigured() {
  return hasResend || hasSmtp;
}
