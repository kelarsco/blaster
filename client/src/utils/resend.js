// Resend Email Utility - Railway Backend API calls
// This sends emails through Railway backend which calls Resend API

import { API } from '../api.js';

/**
 * Send email using Railway backend API
 * @param {Object} emailData - Email data
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendEmail({ to, from, subject, html, text }) {
  console.log('Sending email via Railway backend:', { to, subject, from: from || 'noreply@wiblaster.com' });

  try {
    const response = await fetch(`${API}/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        from: from || 'noreply@wiblaster.com',
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send email');
    }

    console.log('Email sent successfully via Railway:', data);
    return { data };
  } catch (error) {
    console.error('Email sending error:', error);
    return { error: error.message };
  }
}

/**
 * Send verification email using Resend
 * @param {string} email - Recipient email
 * @param {string} type - Email type (SIGNUP_CODE, RESEND_CODE, etc.)
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendVerificationEmail(email, type = 'SIGNUP_CODE') {
  const verificationUrl = `https://wiblaster.com/verify-email?email=${encodeURIComponent(email)}`;
  
  console.log(`📧 Sending ${type} email via Resend to: ${email}`);
  
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
      </div>
    `,
    text: `${type === 'SIGNUP_CODE' ? 'Verify your email address:' : 'Resend verification code:'} ${verificationUrl}`
  });
}

export default {
  sendEmail,
  sendVerificationEmail
};
