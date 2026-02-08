/**
 * Generate a TOTP secret for bl-admin login (Google Authenticator).
 * Run from server dir: node scripts/generate-admin-totp.js
 * Then add BL_ADMIN_TOTP_SECRET=<the base32 secret> to server/.env
 * Add the secret to Google Authenticator (manual entry, or use the otpauth URL in a QR generator).
 */
import speakeasy from 'speakeasy';

const secret = speakeasy.generateSecret({ name: 'wiblaster-admin', length: 20 });
console.log('Add this to your server .env:');
console.log('BL_ADMIN_TOTP_SECRET=' + secret.base32);
console.log('\nFor Google Authenticator (manual entry), use this key:');
console.log(secret.base32);
console.log('\nOr use this otpauth URL in a QR code generator to scan with the app:');
console.log(secret.otpauth_url);
