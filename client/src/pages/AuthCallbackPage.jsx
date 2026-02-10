import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';

/** Handles OAuth callback: ?token=ACCESS_TOKEN from backend redirect. Sets token, fetches user, redirects to app. */
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { setAccessToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const isPopup = typeof window !== 'undefined' && window.opener && window.opener !== window;

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing token');
      return;
    }

    // If we're in a popup, notify the opener and close. The main window will finish login.
    if (isPopup) {
      try {
        window.opener.postMessage({ type: 'oauth-success', token }, window.location.origin);
      } catch (_) {
        // If postMessage fails, just fall back to normal flow below.
      }
      try {
        window.close();
        return;
      } catch (_) {
        // ignore if the browser blocks close; we'll still render the fallback UI.
      }
    }

    // Normal full-page callback flow
    setAccessToken(token);
    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((r) => {
        if (!r.ok) throw new Error('Invalid token');
        return r.json();
      })
      .then((data) => {
        setUser(data);
        navigate('/app/dashboard', { replace: true });
      })
      .catch(() => setError('Sign-in failed. Please try again.'));
  }, [searchParams, setAccessToken, setUser, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/login" className="text-blaster-primary hover:underline">Back to login</a>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-pulse text-blaster-muted text-sm">Signing you in…</div>
    </div>
  );
}
