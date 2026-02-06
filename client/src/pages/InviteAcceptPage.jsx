import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';

const PENDING_INVITE_KEY = 'pendingInviteToken';

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { user, loading, loginWithGoogle } = useAuth();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      return;
    }
    fetch(`${API}/invites/token/${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data ? setInvite(data) : setError('Invite not found or expired')))
      .catch(() => setError('Failed to load invite'));
  }, [token]);

  useEffect(() => {
    if (!user || !token) return;
    fetch(`${API}/invites/accept`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(() => navigate('/app/dashboard', { replace: true }))
      .catch(() => setError('Failed to accept invite'));
  }, [user, token, navigate]);

  const handleSignIn = () => {
    if (!token) return;
    try {
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
    } catch (_) {}
    loginWithGoogle();
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app p-6">
        <div className="text-center text-blaster-muted">Invalid invite link</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app p-6">
        <div className="bg-blaster-bg-card rounded-2xl border border-blaster-border p-8 max-w-md w-full text-center">
          <p className="text-blaster-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app p-6">
        <div className="animate-pulse text-blaster-muted">Loading invite…</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app p-6">
        <div className="bg-blaster-bg-card rounded-2xl border border-blaster-border p-8 max-w-md w-full text-center">
          <p className="text-blaster-muted">Accepting invite…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app p-6">
      <div className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-sm p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-blaster-fg mb-2">You&apos;re invited</h1>
        <p className="text-blaster-muted mb-6">
          <strong>{invite.inviterName}</strong> has invited you to collaborate on wiblaster. Sign in with Google to join and get access to all features they&apos;re eligible for.
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="w-full btn-blaster-accent py-3 rounded-xl flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google to join
        </button>
      </div>
    </div>
  );
}
