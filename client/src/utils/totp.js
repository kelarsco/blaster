// TOTP (Time-based One-Time Password) utility for admin authentication
// Simple implementation without external dependencies

// TOTP secret from environment variables
const TOTP_SECRET = import.meta.env.VITE_BL_ADMIN_TOTP_SECRET;

/**
 * Simple TOTP implementation using crypto API
 * @param {string} secret - The TOTP secret (base32 encoded)
 * @param {number} timeOffset - Time offset in seconds (for testing)
 * @returns {string} - 6-digit TOTP code
 */
export function generateTOTP(secret = TOTP_SECRET, timeOffset = 0) {
  if (!secret) {
    throw new Error('TOTP secret is not configured');
  }

  try {
    // This is a simplified implementation
    // In production, you should use a proper TOTP library
    const timeStep = Math.floor((Date.now() / 1000 + timeOffset) / 30);
    
    // Simple hash-based TOTP (for demo purposes)
    // In production, replace with proper TOTP implementation
    const hash = simpleHash(secret + timeStep);
    const code = (hash % 1000000).toString().padStart(6, '0');
    
    return code;
  } catch (error) {
    console.error('Error generating TOTP:', error);
    throw new Error('TOTP generation failed');
  }
}

/**
 * Simple hash function (for demo purposes only)
 * In production, use proper HMAC-SHA1
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Verify TOTP code against the secret
 * @param {string} token - The 6-digit code to verify
 * @param {string} secret - The TOTP secret (base32 encoded)
 * @param {number} window - Time window in intervals (default: 3 intervals = 90s)
 * @returns {boolean} - Whether the code is valid
 */
export function verifyTOTP(token, secret = TOTP_SECRET, window = 3) {
  if (!token || !secret) {
    return false;
  }

  try {
    // Check current time and adjacent time steps
    const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
    
    for (let offset = -window; offset <= window; offset++) {
      const timeStep = currentTimeStep + offset;
      const hash = simpleHash(secret + timeStep);
      const expectedCode = (hash % 1000000).toString().padStart(6, '0');
      
      if (token === expectedCode) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return false;
  }
}

/**
 * Generate QR code URL for TOTP setup
 * @param {string} secret - The TOTP secret
 * @param {string} accountName - Account name (e.g., "admin@wiblaster.com")
 * @param {string} issuer - Issuer name (e.g., "Wiblaster Admin")
 * @returns {string} - Google Charts QR code URL
 */
export function generateTOTPQRCode(secret, accountName = 'admin@wiblaster.com', issuer = 'Wiblaster Admin') {
  const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const encodedUrl = encodeURIComponent(otpauthUrl);
  return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodedUrl}`;
}

/**
 * Client-side TOTP verification for admin authentication
 * @param {string} token - The 6-digit code to verify
 * @returns {Promise<boolean>} - Whether the code is valid
 */
export async function verifyAdminTOTP(token) {
  return verifyTOTP(token);
}

export default {
  generateTOTP,
  verifyTOTP,
  generateTOTPQRCode,
  verifyAdminTOTP
};
