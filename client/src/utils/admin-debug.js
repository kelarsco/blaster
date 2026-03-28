// Admin Debug Utility - Helps troubleshoot admin login issues

// Test TOTP code generation for debugging
export function generateTestTOTP() {
  const TOTP_SECRET = 'JJZSKQB6NEZHG3STPBUTAI3BOR2F2QKP';
  
  // Use the same algorithm as in totp.js
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  const hash = simpleHash(TOTP_SECRET + timeStep);
  const code = (hash % 1000000).toString().padStart(6, '0');
  
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
    
    for (let offset = -3; offset <= 3; offset++) {
      const timeStep = currentTimeStep + offset;
      
      function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash);
      }
      
      const hash = simpleHash(TOTP_SECRET + timeStep);
      const expectedCode = (hash % 1000000).toString().padStart(6, '0');
      
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
