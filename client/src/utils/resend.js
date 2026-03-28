// Resend Email Utility for Supabase
// Note: This is for client-side use. For production, you should use a backend service.

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

export async function sendEmail({ to, from, subject, html, text }) {
  if (!RESEND_API_KEY) {
    console.warn('Resend API key not found in environment variables');
    return { error: 'Email service not configured' };
  }

  console.log('Sending email:', { to, subject, from: from || 'noreply@wiblaster.com' });

  try {
    // Use verified domain or default to your domain
    const verifiedFrom = from || 'noreply@wiblaster.com';
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: verifiedFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();
    console.log('Resend response:', data);
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email');
    }

    return { data };
  } catch (error) {
    console.error('Email sending error:', error);
    return { error: error.message };
  }
}

export async function sendVerificationEmail(email, verificationCode) {
  const verificationUrl = `${window.location.origin}/verify-email?code=${verificationCode}`;
  
  return sendEmail({
    to: email,
    subject: 'Verify your email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>Thank you for signing up! Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
      </div>
    `,
    text: `Verify your email address: ${verificationUrl}`,
  });
}

export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${window.location.origin}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: email,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
      </div>
    `,
    text: `Reset your password: ${resetUrl}`,
  });
}
