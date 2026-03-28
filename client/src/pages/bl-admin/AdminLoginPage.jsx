import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { verifyAdminTOTP } from '../../utils/totp';
import { generateTestTOTP, verifyTOTPDebug } from '../../utils/admin-debug';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { refetchAdmin, setAdminToken } = useAdmin();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // Generate test code for debugging
  const testCode = generateTestTOTP();
  console.log('🔧 Debug - Current valid TOTP code:', testCode);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDebugInfo(null);
    
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    
    setLoading(true);
    try {
      // Debug verification
      const debugResult = verifyTOTPDebug(code);
      setDebugInfo(debugResult);
      
      // Normal verification
      const isValid = await verifyAdminTOTP(code);
      
      if (isValid) {
        // Generate a simple admin token (in production, this should come from your backend)
        const adminToken = `admin_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setAdminToken(adminToken);
        await refetchAdmin();
        navigate('/bl-admin/overview', { replace: true });
        return;
      }
      
      setError('Invalid code');
    } catch (err) {
      setError(err?.message || 'Authentication failed');
      setDebugInfo({ valid: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app p-4">
      <div className="w-full max-w-sm rounded-2xl border border-blaster-border bg-blaster-bg-card p-8 shadow-lg">
        <h1 className="text-xl font-bold text-blaster-fg text-center">Admin login</h1>
        <p className="text-sm text-blaster-muted text-center mt-1">
          Enter the 6-digit code from your Google Authenticator app
        </p>
        
        {/* Debug Information */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800 font-mono">
            <strong>Debug - Current valid code:</strong> {testCode.code}
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Check browser console for detailed verification logs
          </p>
        </div>
        
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 rounded-xl border border-blaster-border bg-blaster-input-bg text-blaster-fg text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {debugInfo && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-blue-800">
                <strong>Debug Result:</strong> {debugInfo.valid ? '✅ Valid' : '❌ Invalid'}
                {debugInfo.timeStep && ` (Time step: ${debugInfo.timeStep}, Offset: ${debugInfo.offset || 0})`}
              </p>
              {debugInfo.error && <p className="text-xs text-red-600 mt-1">Error: {debugInfo.error}</p>}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-2.5 rounded-xl bg-blaster-fg text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
