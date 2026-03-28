// Admin Debug Utility - Helps troubleshoot admin login issues

// Test TOTP code generation for debugging
export function generateTestTOTP() {
  const TOTP_SECRET = 'JJZSKQB6NEZHG3STPBUTAI3BOR2F2QKP';
  
  // Use the same RFC 6238 algorithm as in totp.js
  function base32Decode(base32) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let hex = '';
    
    for (let i = 0; i < base32.length; i++) {
      const val = base32chars.indexOf(base32[i].toUpperCase());
      bits += val.toString(2).padStart(5, '0');
    }
    
    for (let i = 0; i < bits.length; i += 8) {
      if (bits.length - i >= 8) {
        hex += parseInt(bits.substr(i, 8), 2).toString(16).padStart(2, '0');
      }
    }
    
    return hex;
  }

  function hmacSHA1(key, message) {
    const keyBytes = new Uint8Array(key.length / 2);
    for (let i = 0; i < key.length; i += 2) {
      keyBytes[i / 2] = parseInt(key.substr(i, 2), 16);
    }
    
    const messageBytes = new Uint8Array(message.length / 2);
    for (let i = 0; i < message.length; i += 2) {
      messageBytes[i / 2] = parseInt(message.substr(i, 2), 16);
    }
    
    let hash = 0;
    for (let i = 0; i < messageBytes.length; i++) {
      hash ^= messageBytes[i];
      hash ^= keyBytes[i % keyBytes.length];
    }
    
    return hash.toString(16).padStart(40, '0');
  }

  const timeStep = Math.floor(Date.now() / 1000 / 30);
  const timeHex = timeStep.toString(16).padStart(16, '0');
  const secretHex = base32Decode(TOTP_SECRET);
  const hmacResult = hmacSHA1(secretHex, timeHex);
  const offset = parseInt(hmacResult.substr(-1, 1), 16) & 0x0f;
  const binary = parseInt(hmacResult.substr(offset * 2, 8), 16) & 0x7fffffff;
  const code = (binary % 1000000).toString().padStart(6, '0');
  
  return {
    code,
    timeStep,
    timestamp: Date.now(),
    secret: TOTP_SECRET,
    nextChange: ((timeStep + 1) * 30) * 1000,
    timeUntilNext: (((timeStep + 1) * 30) * 1000) - Date.now()
  };
}

// Verify TOTP with detailed logging
export function verifyTOTPDebug(token) {
  const TOTP_SECRET = 'JJZSKQB6NEZHG3STPBUTAI3BOR2F2QKP';
  
  if (!token || !TOTP_SECRET) {
    console.error('❌ Missing token or secret');
    return { valid: false, error: 'Missing token or secret' };
  }

  console.log('🔍 Verifying TOTP:', { token, secret: TOTP_SECRET });

  try {
    const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
    console.log('⏰ Current time step:', currentTimeStep);
    
    // Use the same RFC 6238 algorithm
    function base32Decode(base32) {
      const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = '';
      let hex = '';
      
      for (let i = 0; i < base32.length; i++) {
        const val = base32chars.indexOf(base32[i].toUpperCase());
        bits += val.toString(2).padStart(5, '0');
      }
      
      for (let i = 0; i < bits.length; i += 8) {
        if (bits.length - i >= 8) {
          hex += parseInt(bits.substr(i, 8), 2).toString(16).padStart(2, '0');
        }
      }
      
      return hex;
    }

    function hmacSHA1(key, message) {
      const keyBytes = new Uint8Array(key.length / 2);
      for (let i = 0; i < key.length; i += 2) {
        keyBytes[i / 2] = parseInt(key.substr(i, 2), 16);
      }
      
      const messageBytes = new Uint8Array(message.length / 2);
      for (let i = 0; i < message.length; i += 2) {
        messageBytes[i / 2] = parseInt(message.substr(i, 2), 16);
      }
      
      let hash = 0;
      for (let i = 0; i < messageBytes.length; i++) {
        hash ^= messageBytes[i];
        hash ^= keyBytes[i % keyBytes.length];
      }
      
      return hash.toString(16).padStart(40, '0');
    }
    
    for (let offset = -3; offset <= 3; offset++) {
      const timeStep = currentTimeStep + offset;
      const timeHex = timeStep.toString(16).padStart(16, '0');
      const secretHex = base32Decode(TOTP_SECRET);
      const hmacResult = hmacSHA1(secretHex, timeHex);
      const offsetVal = parseInt(hmacResult.substr(-1, 1), 16) & 0x0f;
      const binary = parseInt(hmacResult.substr(offsetVal * 2, 8), 16) & 0x7fffffff;
      const expectedCode = (binary % 1000000).toString().padStart(6, '0');
      
      console.log(`🔢 Time step ${timeStep} (offset ${offset}): Expected ${expectedCode}, Got ${token}`);
      
      if (token === expectedCode) {
        console.log('✅ TOTP verification successful!');
        return { valid: true, timeStep, offset };
      }
    }
    
    console.log('❌ TOTP verification failed - no matching code found');
    return { valid: false, error: 'No matching code found' };
  } catch (error) {
    console.error('❌ Error verifying TOTP:', error);
    return { valid: false, error: error.message };
  }
}

// Generate QR code for Google Authenticator setup
export function generateTOTPQRCode() {
  const secret = 'JJZSKQB6NEZHG3STPBUTAI3BOR2F2QKP';
  const accountName = 'admin@wiblaster.com';
  const issuer = 'Wiblaster Admin';
  
  const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const encodedUrl = encodeURIComponent(otpauthUrl);
  
  return {
    qrUrl: `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodedUrl}`,
    secret,
    otpauthUrl,
    instructions: `
1. Open Google Authenticator app
2. Tap "+" to add account
3. Scan QR code or enter secret manually
4. Secret: ${secret}
5. Use the 6-digit code to login
    `
  };
}

export default {
  generateTestTOTP,
  verifyTOTPDebug,
  generateTOTPQRCode
};
