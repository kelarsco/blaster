import { getDb } from '../db.js';

// Vercel API configuration
const VERCEL_EMAIL_API_URL = process.env.VERCEL_EMAIL_API_URL || 'https://your-vercel-app.vercel.app/api/send-email';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'your-secret-key-here';

/**
 * Send email via Vercel API (fire-and-forget)
 * @param {Object} params - Email parameters
 * @param {Object} params.smtpConfig - SMTP configuration
 * @param {string} params.smtpConfig.host - SMTP host
 * @param {number} params.smtpConfig.port - SMTP port
 * @param {boolean} params.smtpConfig.secure - Use secure connection
 * @param {string} params.smtpConfig.user - SMTP username
 * @param {string} params.smtpConfig.pass - SMTP password
 * @param {Object} params.email - Email details
 * @param {string} params.email.to - Recipient email
 * @param {string} params.email.subject - Email subject
 * @param {string} params.email.html - Email HTML content
 * @param {string} params.email.from - From email (optional)
 */
export async function sendEmailViaVercel({ smtpConfig, email }) {
  try {
    // Validate required fields
    if (!smtpConfig || !email) {
      console.error('Missing smtpConfig or email data');
      return { success: false, error: 'Missing required data' };
    }

    const { host, port, secure, user, pass } = smtpConfig;
    const { to, subject, html, from } = email;

    if (!host || !port || !user || !pass || !to || !subject) {
      console.error('Missing required SMTP or email fields');
      return { success: false, error: 'Missing required fields' };
    }

    // Prepare request payload
    const payload = {
      smtpConfig: {
        host,
        port,
        secure: secure === true || secure === 'true',
        user,
        pass,
      },
      email: {
        to,
        subject,
        html,
        from: from || user,
      },
    };

    // Send to Vercel API (fire-and-forget)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(VERCEL_EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch(error => {
      console.error('Vercel API request failed:', error);
      return { success: false, error: 'API request failed' };
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Vercel API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    // Fire-and-forget - don't wait for response body
    console.log('Email request sent to Vercel API successfully');
    return { success: true };

  } catch (error) {
    console.error('Error sending email via Vercel:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log email to database (for tracking/audit)
 */
export async function logEmailToDb(userId, emailDetails, status = 'sent') {
  try {
    const db = getDb();
    if (!db) return;

    await db.query(
      `INSERT INTO email_logs (user_id, to_email, subject, status, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, emailDetails.to, emailDetails.subject, status]
    );
  } catch (error) {
    console.error('Failed to log email to database:', error);
  }
}

/**
 * Main email sending function (replacement for direct Nodemailer)
 */
export async function sendEmail(userId, smtpConfig, emailDetails) {
  try {
    // Log email attempt
    await logEmailToDb(userId, emailDetails, 'attempted');

    // Send via Vercel API (fire-and-forget)
    const result = await sendEmailViaVercel({ 
      smtpConfig, 
      email: emailDetails 
    });

    if (result.success) {
      await logEmailToDb(userId, emailDetails, 'sent');
    } else {
      await logEmailToDb(userId, emailDetails, 'failed');
    }

    return result;

  } catch (error) {
    console.error('Email sending error:', error);
    await logEmailToDb(userId, emailDetails, 'error');
    return { success: false, error: error.message };
  }
}
