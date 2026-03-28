# EmailJS Setup Guide

This guide will help you set up EmailJS to send real emails from your Wiblaster application.

## 📧 What is EmailJS?

EmailJS is a service that allows you to send emails directly from the client-side (browser) without needing a backend server. It's perfect for contact forms, verification emails, and notifications.

## 🔧 Setup Steps

### 1. Create EmailJS Account

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click "Sign Up" and create a free account
3. Verify your email address

### 2. Create Email Service

1. After logging in, click "Email Services" in the dashboard
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the connection instructions:
   - For Gmail: Enable 2-factor authentication and use an App Password
   - For Outlook: Use your regular credentials
5. Once connected, you'll get a **Service ID**

### 3. Create Email Template

1. Click "Email Templates" in the dashboard
2. Click "Create New Template"
3. Fill in the template details:
   - **Template Name**: "Wiblaster Verification"
   - **Subject**: `{{subject}}`
   - **Content**: Use this HTML template:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{subject}}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; color: #333; }
        .content { margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .footer { color: #666; font-size: 14px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>{{subject}}</h2>
    </div>
    <div class="content">
        {{{html_content}}}
    </div>
    <div class="footer">
        <p>This email was sent from Wiblaster</p>
    </div>
</body>
</html>
```

4. Click "Save" - you'll get a **Template ID**

### 4. Get Your Keys

1. In EmailJS dashboard, click "Account" → "API Keys"
2. You'll see your **Public Key** and **Private Key**
3. Copy these keys for the next step

### 5. Update Environment Variables

Add these values to your `.env.local` file:

```env
# EmailJS Configuration
VITE_EMAILJS_SERVICE_ID=your_service_id_here
VITE_EMAILJS_TEMPLATE_ID=your_template_id_here
VITE_EMAILJS_PUBLIC_KEY=your_public_key_here
VITE_EMAILJS_PRIVATE_KEY=your_private_key_here
```

Replace the placeholder values with your actual EmailJS credentials.

### 6. Test Email Sending

1. Restart your development server
2. Try signing up for a new account
3. Check your email inbox for the verification email
4. Check browser console for email sending logs

## 📧 Template Variables

The EmailJS template uses these variables:

- `{{subject}}` - Email subject line
- `{{html_content}}` - HTML email body
- `{{text_content}}` - Plain text email body
- `{{to_email}}` - Recipient email address
- `{{from_name}}` - Sender name (Wiblaster)
- `{{reply_to}}` - Reply-to email address

## 🔍 Troubleshooting

### Common Issues:

1. **Email not sending**: Check EmailJS dashboard for delivery status
2. **Template not found**: Verify Template ID is correct
3. **Service not connected**: Reconnect your email service in EmailJS
4. **Keys not working**: Regenerate API keys in EmailJS dashboard

### Testing:

1. Use EmailJS dashboard "Send Test Email" feature
2. Check browser console for error messages
3. Verify all environment variables are loaded

## 🚀 Production Deployment

For production deployment:

1. Add EmailJS environment variables to your hosting platform
2. Update your domain in EmailJS settings if needed
3. Monitor email delivery in EmailJS dashboard

## 💡 Tips

- EmailJS free plan allows 200 emails per month
- For higher volume, consider upgrading to a paid plan
- Keep your EmailJS templates simple and responsive
- Test thoroughly before deploying to production

## 🔐 Security Notes

- Never expose your EmailJS Private Key in client-side code
- Environment variables are safe for client-side use
- Consider using email rate limiting in production

---

**Once setup is complete, your Wiblaster application will send real emails to users' Gmail addresses!**
