import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';
import { getStoredPlanId } from '../data/plans';
import { AuthLayout, AuthLogoLink, authInputClass, authPrimaryButtonClass, authSecondaryButtonClass, PasswordInput, PasswordInputFollow } from '../layout/AuthLayout';

function getPostSignupPath(search) {
  const fromPricing = search && search.includes('from=pricing');
  const storedPlan = getStoredPlanId();
  if (fromPricing || (storedPlan && storedPlan !== 'free')) return '/app/account/pricing';
  return '/app/dashboard';
}

export function SignupPage() {
  const { user, loading, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) navigate(getPostSignupPath(), { replace: true });
  }, [user, loading, navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Username is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      if (data.needsVerification && data.email) {
        navigate('/verify-email', { state: { email: data.email }, replace: true });
        return;
      }
      navigate(getPostSignupPath(location.search), { replace: true });
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-blaster-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (user) return null;

  return (
    <AuthLayout>
      <AuthLogoLink />
      <h1 className="text-2xl font-bold text-blaster-fg">Create your account</h1>
      <p className="mt-1.5 text-sm text-blaster-muted">Get started with wiblaster — verify your email to activate your account.</p>

      <form onSubmit={handleSignup} className="mt-6 space-y-4">
        <div>
          <label htmlFor="signup-username" className="block text-sm font-medium text-blaster-fg mb-1">
            Username
          </label>
          <input
            id="signup-username"
            type="text"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder=""
            className={authInputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-blaster-fg mb-1">
            Email
          </label>
          <p className="text-xs text-blaster-muted mb-1.5">We&apos;ll send a 6-digit verification code to this address.</p>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className="block text-sm font-medium text-blaster-fg mb-1">
            Password
          </label>
          <PasswordInput
            id="signup-password"
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
          <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-blaster-fg mb-1">
            Confirm password
          </label>
          <PasswordInputFollow
            id="signup-confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder=""
            autoComplete="new-password"
            required
            minLength={8}
            className={authInputClass}
            visible={passwordVisible}
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600">
            <p>{error}</p>
            {error.toLowerCase().includes('already exists') && (
              <Link to="/login" className="mt-2 inline-block font-medium hover:underline">
                Sign in instead →
              </Link>
            )}
          </div>
        )}
        <button type="submit" disabled={submitting} className={authPrimaryButtonClass}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="mt-5 flex items-center gap-3">
        <span className="flex-1 h-px bg-blaster-border" />
        <span className="text-xs text-blaster-muted">or</span>
        <span className="flex-1 h-px bg-blaster-border" />
      </div>
      <div className="mt-5">
        <button
          type="button"
          onClick={loginWithGoogle}
          className={authSecondaryButtonClass + ' flex items-center justify-center gap-2'}
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </button>
        <p className="mt-2 text-xs text-blaster-muted text-center">
          If you already have an account with this email, you’ll sign in instead.
        </p>
      </div>

      <p className="mt-6 text-sm text-blaster-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-blaster-fg font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
