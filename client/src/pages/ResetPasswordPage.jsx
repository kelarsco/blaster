import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';
import { AuthLayout, AuthLogoLink, authInputClass, authPrimaryButtonClass, PasswordInput, PasswordInputFollow } from '../layout/AuthLayout';

export function ResetPasswordPage() {
  const { setUser, setAccessTokenState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [noToken, setNoToken] = useState(false);

  useEffect(() => {
    if (!token.trim()) setNoToken(true);
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      if (data.user) setUser(data.user);
      if (data.accessToken) setAccessTokenState(data.accessToken);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (noToken) {
    return (
      <AuthLayout>
        <AuthLogoLink />
        <h1 className="text-2xl font-bold text-blaster-fg">Invalid reset link</h1>
        <p className="mt-1.5 text-sm text-blaster-muted">
          This link is invalid or has expired. Request a new password reset from the sign in page.
        </p>
        <Link to="/forgot-password" className={authPrimaryButtonClass + ' mt-6 inline-block text-center'}>
          Request new reset link
        </Link>
        <p className="mt-6 text-sm text-blaster-muted">
          <Link to="/login" className="text-blaster-fg font-semibold hover:underline">Back to sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthLogoLink />
      <h1 className="text-2xl font-bold text-blaster-fg">Set new password</h1>
      <p className="mt-1.5 text-sm text-blaster-muted">
        Enter your new password below. Use at least 8 characters.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium text-blaster-fg mb-1">
            New password
          </label>
          <PasswordInput
            id="reset-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder=""
            autoComplete="new-password"
            required
            minLength={8}
            className={authInputClass}
            visible={passwordVisible}
            onVisibilityChange={setPasswordVisible}
          />
        </div>
        <div>
          <label htmlFor="reset-confirm" className="block text-sm font-medium text-blaster-fg mb-1">
            Confirm password
          </label>
          <PasswordInputFollow
            id="reset-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder=""
            autoComplete="new-password"
            required
            minLength={8}
            className={authInputClass}
            visible={passwordVisible}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className={authPrimaryButtonClass}>
          {submitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

      <p className="mt-6 text-sm text-blaster-muted">
        <Link to="/login" className="text-blaster-fg font-semibold hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
