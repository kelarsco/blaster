// Email Utility - For now, we'll simulate email sending
// In production, you should use a backend service or Supabase Edge Functions

// Resend API Key (kept for reference, but not used in client)
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

/**
 * Simulate email sending (for demo purposes)
 * In production, this should call your backend API or Supabase Edge Functions
 * @param {Object} emailData - Email data
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendEmail({ to, from, subject, html, text }) {
  console.log('📧 Email sending simulated:', { to, subject, from: from || 'noreply@wiblaster.com' });
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // In production, replace this with actual email sending:
  // try {
  //   const response = await fetch('https://api.resend.com/emails', {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': `Bearer ${RESEND_API_KEY}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       from: from || 'noreply@wiblaster.com',
  //       to: Array.isArray(to) ? to : [to],
  //       subject,
  //       html,
  //       text,
  //     }),
  //   });
  //   const data = await response.json();
  //   if (!response.ok) throw new Error(data.message || 'Failed to send email');
  //   return { data };
  // } catch (error) {
  //   console.error('Email sending error:', error);
  //   return { error: error.message };
  // }
  
  return { data: { id: 'simulated-email-id' } };
}

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {string} type - Email type (SIGNUP_CODE, RESEND_CODE, etc.)
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendVerificationEmail(email, type = 'SIGNUP_CODE') {
  const verificationUrl = `https://wiblaster.com/verify-email?email=${encodeURIComponent(email)}`;
  
  console.log(`📧 Sending ${type} email to: ${email}`);
  
  return sendEmail({
    to: email,
    subject: type === 'SIGNUP_CODE' ? 'Verify your email address' : 'Resend verification code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${type === 'SIGNUP_CODE' ? 'Verify Your Email Address' : 'Resend Verification Code'}</h2>
        <p>${type === 'SIGNUP_CODE' ? 
          'Thank you for signing up! Please click the link below to verify your email address:' :
          'Please click the link below to get a new verification code:'}</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
          ${type === 'SIGNUP_CODE' ? 'Verify Email' : 'Get New Code'}
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <div style="margin-top: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            <strong>Note:</strong> Email sending is simulated in this demo. 
            In production, configure your backend to send actual emails.
          </p>
        </div>
      </div>
    `,
    text: `${type === 'SIGNUP_CODE' ? 'Verify your email address:' : 'Resend verification code:'} ${verificationUrl}`
  });
}

export default {
  sendEmail,
  sendVerificationEmail
};
