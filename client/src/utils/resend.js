// Email Utility - Uses EmailJS for direct client-side email sending
// This replaces the simulated email sending with actual email delivery

import { sendVerificationEmailEmailJS } from './emailjs-service.js';

/**
 * Send email using EmailJS (real email delivery)
 * @param {Object} emailData - Email data
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendEmail({ to, from, subject, html, text }) {
  console.log('📧 Sending email via EmailJS:', { to, subject, from: from || 'noreply@wiblaster.com' });
  
  try {
    const { sendEmailWithEmailJS } = await import('./emailjs-service.js');
    const result = await sendEmailWithEmailJS({ to, from, subject, html, text });
    return result;
  } catch (error) {
    console.error('Email sending error:', error);
    return { error: error.message };
  }
}

/**
 * Send verification email using EmailJS
 * @param {string} email - Recipient email
 * @param {string} type - Email type (SIGNUP_CODE, RESEND_CODE, etc.)
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendVerificationEmail(email, type = 'SIGNUP_CODE') {
  console.log(`📧 Sending ${type} email via EmailJS to: ${email}`);
  
  try {
    const result = await sendVerificationEmailEmailJS(email, type);
    return result;
  } catch (error) {
    console.error('Verification email error:', error);
    return { error: error.message };
  }
}

export default {
  sendEmail,
  sendVerificationEmail
};
