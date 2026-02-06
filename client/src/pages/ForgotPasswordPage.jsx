import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api.js';
import { AuthLayout, AuthLogoLink, authInputClass, authPrimaryButtonClass } from '../layout/AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthLogoLink />
      <h1 className="text-2xl font-bold text-blaster-fg">Forgot password?</h1>
      <p className="mt-1.5 text-sm text-blaster-muted">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-blaster-fg mb-1">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
            className={authInputClass}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">
            If an account exists with this email, you will receive a reset link shortly. Check your inbox.
          </p>
        )}
        <button type="submit" disabled={submitting} className={authPrimaryButtonClass}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-sm text-blaster-muted">
        <Link to="/login" className="text-blaster-fg font-semibold hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
