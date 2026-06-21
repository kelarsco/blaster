import nodemailer from 'nodemailer';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.FRONTEND_URL || '';

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN || '',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
});

export default async function handler(req, res) {
  try {
    const origin = req.headers.origin || '';
    const headers = corsHeaders(origin);

    if (req.method === 'OPTIONS') {
      return res.status(200).setHeaders(headers).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).setHeaders(headers).json({ error: 'Method not allowed' });
    }

    if (!INTERNAL_API_KEY) {
      return res.status(503).setHeaders(headers).json({ error: 'Service not configured' });
    }

    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    if (apiKey !== INTERNAL_API_KEY) {
      return res.status(401).setHeaders(headers).json({ error: 'Unauthorized' });
    }

    const { smtpConfig, email } = req.body;

    if (!smtpConfig || !email) {
      return res.status(400).setHeaders(headers).json({ error: 'Missing smtpConfig or email data' });
    }

    const { host, port, secure, user, pass } = smtpConfig;
    const { to, subject, html, from } = email;

    if (!host || !port || !user || !pass || !to || !subject) {
      return res.status(400).setHeaders(headers).json({ error: 'Missing required SMTP or email fields' });
    }

    const transporter = nodemailer.createTransporter({
      host,
      port: parseInt(port, 10),
      secure: secure === true || secure === 'true',
      auth: { user, pass },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });

    await transporter.sendMail({
      from: from || user,
      to,
      subject,
      html,
    });

    return res.status(200).setHeaders(headers).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    const statusCode = error.code === 'EAUTH' ? 401 : error.code === 'ECONNECTION' ? 503 : 500;
    return res.status(statusCode).json({ error: 'Failed to send email' });
  }
}
