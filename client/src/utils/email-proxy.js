// Email Proxy Utility - Uses Supabase Edge Functions or backend proxy
// Since Resend doesn't allow direct browser calls, we'll use Supabase Edge Functions

import { supabase } from './supabase.js';

/**
 * Send email using Supabase Edge Functions as proxy
 * @param {Object} emailData - Email data
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendEmailProxy({ to, from, subject, html, text }) {
  try {
    // Call Supabase Edge Function to send email
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        from: from || 'noreply@wiblaster.com',
        subject,
        html,
        text
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('Email proxy error:', error);
    return { error: error.message };
  }
}

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {string} type - Email type (SIGNUP_CODE, RESEND_CODE, etc.)
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendVerificationEmail(email, type = 'SIGNUP_CODE') {
  const verificationUrl = `https://wiblaster.com/verify-email?email=${encodeURIComponent(email)}`;
  
  return sendEmailProxy({
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
  sendEmailProxy,
  sendVerificationEmail
};
