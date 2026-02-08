/**
 * Send verification code email. Uses Resend if RESEND_API_KEY is set,
 * otherwise falls back to nodemailer (INVITE_SMTP_* env vars).
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

const FROM_EMAIL = process.env.VERIFICATION_EMAIL_FROM || process.env.INVITE_EMAIL_FROM || process.env.INVITE_SMTP_USER || 'no-reply@wiblaster.com';
const FROM_NAME = process.env.VERIFICATION_EMAIL_FROM_NAME || 'wiblaster';

export async function sendVerificationCode(toEmail, code) {
  const subject = 'Your wiblaster sign-in code';
  const html = `
    <p>Hi,</p>
    <p>Your verification code to sign in to wiblaster is:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;margin:20px 0;">${code}</p>
    <p>This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
    <p>— wiblaster</p>
  `;

  if (resendClient) {
    const from = FROM_EMAIL.includes('@') ? `${FROM_NAME} <${FROM_EMAIL}>` : FROM_EMAIL;
    const { data, error } = await resendClient.emails.send({
      from: from,
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

export function isVerificationEmailConfigured() {
  return hasResend || hasSmtp;
}
