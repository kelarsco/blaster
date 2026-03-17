import nodemailer from 'nodemailer';

// Simple API key for security (change this to a secure value)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'your-secret-key-here';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export default async function handler(req, res) {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).setHeaders(corsHeaders).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).setHeaders(corsHeaders).json({ 
        error: 'Method not allowed' 
      });
    }

    // Verify API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    if (apiKey !== INTERNAL_API_KEY) {
      return res.status(401).setHeaders(corsHeaders).json({ 
        error: 'Unauthorized' 
      });
    }

    const { smtpConfig, email } = req.body;

    // Validate required fields
    if (!smtpConfig || !email) {
      return res.status(400).setHeaders(corsHeaders).json({ 
        error: 'Missing smtpConfig or email data' 
      });
    }

    const { host, port, secure, user, pass } = smtpConfig;
    const { to, subject, html, from } = email;

    if (!host || !port || !user || !pass || !to || !subject) {
      return res.status(400).setHeaders(corsHeaders).json({ 
        error: 'Missing required SMTP or email fields' 
      });
    }

    // Create transporter with user's SMTP credentials
    const transporter = nodemailer.createTransporter({
      host,
      port: parseInt(port),
      secure: secure === true || secure === 'true',
      auth: {
        user,
        pass,
      },
      // Timeout settings
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });

    // Send email
    const mailOptions = {
      from: from || user,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).setHeaders(corsHeaders).json({ 
      success: true,
      message: 'Email sent successfully' 
    });

  } catch (error) {
    console.error('Email sending error:', error);
    
    // Return appropriate error response
    const statusCode = error.code === 'EAUTH' ? 401 : 
                      error.code === 'ECONNECTION' ? 503 : 500;
    
    return res.status(statusCode).setHeaders(corsHeaders).json({ 
      error: 'Failed to send email',
      details: error.message,
      code: error.code 
    });
  }
}
