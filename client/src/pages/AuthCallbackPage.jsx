import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';
import { handleOAuthPopupResult } from '../utils/oauth.js';

/** Handles OAuth callback: refresh cookie auth, fetch user, redirect to app. */
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { setAccessToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const hasOpener = typeof window !== 'undefined' && window.opener && window.opener !== window;
  const popupByName = typeof window !== 'undefined' && window.name === 'google-login';
  const isPopup = Boolean(hasOpener || popupByName);

  useEffect(() => {
    const legacyToken = searchParams.get('token');

    if (isPopup) {
      if (legacyToken) {
        handleOAuthPopupResult(legacyToken);
      } else {
        handleOAuthPopupResult(null);
      }
      return;
    }

    const finish = async () => {
      try {
        if (legacyToken) {
          const meRes = await fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${legacyToken}` },
            credentials: 'include',
          });
          if (!meRes.ok) throw new Error('Invalid token');
          const userData = await meRes.json();
          setAccessToken(legacyToken, userData);
          navigate('/app/dashboard', { replace: true });
          return;
        }

        const refreshRes = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await refreshRes.json().catch(() => ({}));
        if (!refreshRes.ok || !data.accessToken) {
          throw new Error('Sign-in failed');
        }
        setAccessToken(data.accessToken, data.user);
        navigate('/app/dashboard', { replace: true });
      } catch {
        setError('Sign-in failed. Please try again.');
      }
    };

    finish();
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
