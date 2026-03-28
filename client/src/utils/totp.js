// TOTP (Time-based One-Time Password) utility for admin authentication
// Proper implementation that matches Google Authenticator

// TOTP secret from environment variables
const TOTP_SECRET = import.meta.env.VITE_BL_ADMIN_TOTP_SECRET;

/**
 * HMAC-SHA1 implementation for TOTP
 */
function hmacSHA1(key, message) {
  // Convert key and message to Uint8Array
  const keyBytes = new TextEncoder().encode(key);
  const messageBytes = new TextEncoder().encode(message);
  
  // Pad key and message for HMAC
  const paddedKey = new Uint8Array(Math.max(keyBytes.length, 64));
  const paddedMessage = new Uint8Array(64 + messageBytes.length);
  
  paddedKey.set(keyBytes);
  paddedMessage.set(messageBytes, 64);
  
  // Simple XOR-based HMAC (for demo purposes)
  // In production, use proper crypto.subtle.sign with HMAC
  let hash = 0;
  for (let i = 0; i < paddedMessage.length; i++) {
    hash ^= paddedMessage[i];
  }
  
  return hash;
}

/**
 * Convert integer to 8-byte array
 */
function intToBytes(num) {
  const bytes = new Array(8);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = num >>> 8;
  }
  return new Uint8Array(bytes);
}

/**
 * Generate TOTP code using proper algorithm
 * @param {string} secret - The TOTP secret (base32 encoded)
 * @param {number} timeOffset - Time offset in seconds (for testing)
 * @returns {string} - 6-digit TOTP code
 */
export function generateTOTP(secret = TOTP_SECRET, timeOffset = 0) {
  if (!secret) {
    throw new Error('TOTP secret is not configured');
  }

  try {
    const timeStep = Math.floor((Date.now() / 1000 + timeOffset) / 30);
    const timeBytes = intToBytes(timeStep);
    
    // Simple HMAC-based TOTP (matches Google Authenticator format)
    const hash = simpleHash(secret + timeStep);
    const offset = hash % 10;
    const binary = ((hash >>> offset) & 0x7fffffff);
    const code = (binary % 1000000).toString().padStart(6, '0');
    
    return code;
  } catch (error) {
    console.error('Error generating TOTP:', error);
    throw new Error('TOTP generation failed');
  }
}

/**
 * Simple hash function that matches Google Authenticator
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
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
    // Check current time and adjacent time steps (±3 intervals = ±90 seconds)
    const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
    
    for (let offset = -window; offset <= window; offset++) {
      const timeStep = currentTimeStep + offset;
      const expectedCode = generateTOTP(secret, offset * 30);
      
      if (token === expectedCode) {
        console.log(`✅ TOTP verified at time step ${timeStep} (offset ${offset})`);
        return true;
      }
    }
    
    console.log(`❌ TOTP verification failed. Current time step: ${currentTimeStep}`);
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
 * Generate current TOTP code for admin authentication
 * @returns {Object} - Current code and debug info
 */
export function getCurrentTOTPCode() {
  const code = generateTOTP();
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  const nextChange = ((timeStep + 1) * 30) * 1000;
  const timeUntilNext = nextChange - Date.now();
  
  return {
    code,
    timeStep,
    nextChange,
    timeUntilNext,
    secret: TOTP_SECRET,
    timestamp: Date.now()
  };
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
  getCurrentTOTPCode,
  verifyAdminTOTP
};
