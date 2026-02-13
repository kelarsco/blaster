import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';

/** Handles OAuth callback: ?token=ACCESS_TOKEN from backend redirect. Sets token, fetches user, redirects to app. */
export function AuthCallbackPage() {
  const OAUTH_POPUP_RESULT_STORAGE_KEY = 'wiblaster_oauth_popup_result';
  const [searchParams] = useSearchParams();
  const { setAccessToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const hasOpener = typeof window !== 'undefined' && window.opener && window.opener !== window;
  const popupByName = typeof window !== 'undefined' && window.name === 'google-login';
  const isPopup = Boolean(hasOpener || popupByName);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing token');
      return;
    }

    // If we're in a popup, notify opener first. If opener is blocked by COOP, use localStorage.
    if (isPopup) {
      let notified = false;
      try {
        window.opener.postMessage({ type: 'oauth-success', token }, window.location.origin);
        notified = true;
      } catch (_) {
        // Ignore and fallback to storage channel.
      }
      if (!notified) {
        try {
          localStorage.setItem(
            OAUTH_POPUP_RESULT_STORAGE_KEY,
            JSON.stringify({ type: 'oauth-success', token, ts: Date.now() })
          );
        } catch (_) {
          // Ignore storage failures and continue with normal flow.
        }
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
  }, [searchParams, setAccessToken, setUser, navigate, isPopup]);

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
