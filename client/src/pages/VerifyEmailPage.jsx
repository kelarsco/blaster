import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/SupabaseAuthContext';
import { AuthLayout, AuthLogoLink, authInputClass, authPrimaryButtonClass } from '../layout/AuthLayout';

export function VerifyEmailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = location.state?.email || '';
  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!emailFromState && !email) {
      const params = new URLSearchParams(location.search);
      const e = params.get('email');
      if (e) setEmail(e);
    }
  }, [emailFromState, location.search, email]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !code.trim()) {
      setError('Email and verification code are required');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`${API}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      if (data.user) setUser(data.user);
      if (data.accessToken) setAccessTokenState(data.accessToken);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setError('');
    setResendSuccess(false);
    if (!email.trim()) {
      setError('Enter your email to resend the code');
      return;
    }
    setResending(true);
    try {
      const res = await fetch(`${API}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      setResendSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <AuthLogoLink />
      <h1 className="text-2xl font-bold text-blaster-fg">Verify your email</h1>
      <p className="mt-1.5 text-sm text-blaster-muted">
        We sent a 6-digit code to your email. Enter it below to activate your account.
      </p>

      <form onSubmit={handleVerify} className="mt-6 space-y-4">
        <div>
          <label htmlFor="verify-email" className="block text-sm font-medium text-blaster-fg mb-1">
            Email
          </label>
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
            className={authInputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="verify-code" className="block text-sm font-medium text-blaster-fg mb-1">
            Verification code
          </label>
          <input
            id="verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder=""
            className={authInputClass + ' text-center tracking-[0.4em] font-mono'}
            maxLength={6}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {resendSuccess && <p className="text-sm text-green-600">Code sent. Check your email.</p>}
        <button type="submit" disabled={verifying || code.length !== 6} className={authPrimaryButtonClass}>
          {verifying ? 'Verifying…' : 'Verify and continue'}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="w-full text-sm text-blaster-muted hover:text-blaster-fg py-2 disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Resend code'}
        </button>
      </form>

      <p className="mt-6 text-sm text-blaster-muted">
        <Link to="/login" className="text-blaster-fg font-medium hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
