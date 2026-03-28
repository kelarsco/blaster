// EmailJS Service - Direct email sending from client
// This uses EmailJS service which allows client-side email sending

// EmailJS configuration (you'll need to set up an EmailJS account)
const EMAILJS_CONFIG = {
  serviceID: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  templateID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  privateKey: import.meta.env.VITE_EMAILJS_PRIVATE_KEY
};

/**
 * Send email using EmailJS
 * @param {Object} emailData - Email data
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendEmailWithEmailJS({ to, subject, html, text }) {
  try {
    // Load EmailJS script dynamically
    if (!window.emailjs) {
      await loadEmailJSScript();
    }

    const templateParams = {
      to_email: to,
      subject: subject,
      html_content: html,
      text_content: text,
      from_name: 'Wiblaster',
      reply_to: 'noreply@wiblaster.com'
    };

    const response = await window.emailjs.send(
      EMAILJS_CONFIG.serviceID,
      EMAILJS_CONFIG.templateID,
      templateParams,
      {
        publicKey: EMAILJS_CONFIG.publicKey,
        privateKey: EMAILJS_CONFIG.privateKey
      }
    );

    console.log('Email sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Load EmailJS script dynamically
 */
function loadEmailJSScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = () => {
      window.emailjs = window.emailjs || window.EmailJS;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Send verification email using EmailJS
 * @param {string} email - Recipient email
 * @param {string} type - Email type (SIGNUP_CODE, RESEND_CODE, etc.)
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendVerificationEmailEmailJS(email, type = 'SIGNUP_CODE') {
  const verificationUrl = `https://wiblaster.com/verify-email?email=${encodeURIComponent(email)}`;
  
  return sendEmailWithEmailJS({
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
  sendEmailWithEmailJS,
  sendVerificationEmailEmailJS
};
