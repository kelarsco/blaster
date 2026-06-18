import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API, hasConfiguredBackend } from '../api.js';
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistAccessToken = useCallback((token) => {
    try {
      if (token) {
        localStorage.setItem('accessToken', token);
      } else {
        localStorage.removeItem('accessToken');
      }
    } catch (_) {}
  }, []);

  /** Refresh access token using refresh token from cookies. */
  const doRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === 'SUSPENDED') {
        return { ok: false, suspended: true, data };
      }
      if (!res.ok || !data.accessToken) return { ok: false };
      return { ok: true, accessToken: data.accessToken, user: data.user };
    } catch (_) {
      return { ok: false };
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('accessToken');
        if (storedToken) {
          const res = await fetch(`${API}/auth/me`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${storedToken}`,
            },
            credentials: 'include',
          });

          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            setAccessTokenState(storedToken);
            return;
          }
        }

        const refreshResult = await doRefresh();
        if (refreshResult?.suspended) {
          persistAccessToken(null);
          setAccessTokenState(null);
          setUser(null);
          return;
        }
        if (refreshResult?.ok && refreshResult.accessToken) {
          setUser(refreshResult.user);
          setAccessTokenState(refreshResult.accessToken);
          persistAccessToken(refreshResult.accessToken);
          return;
        }

        persistAccessToken(null);
        setAccessTokenState(null);
        setUser(null);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [doRefresh, persistAccessToken]);

  /** Authenticated fetch: adds Bearer token, on 401 tries refresh once then retries. */
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = { ...options.headers };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let res = await fetch(url, { ...options, credentials: 'include', headers });
    if (res.status === 401) {
      const refreshResult = await doRefresh();
      if (refreshResult?.suspended) {
        setUser(null);
        setAccessTokenState(null);
        persistAccessToken(null);
        const msg = encodeURIComponent(refreshResult.data?.error || 'Account suspended.');
        window.location.href = `/login?error=suspended&message=${msg}`;
        return res;
      }
      if (refreshResult?.ok && refreshResult.accessToken) {
        setUser(refreshResult.user);
        setAccessTokenState(refreshResult.accessToken);
        persistAccessToken(refreshResult.accessToken);
        const retryHeaders = { ...options.headers, Authorization: `Bearer ${refreshResult.accessToken}` };
        res = await fetch(url, { ...options, credentials: 'include', headers: retryHeaders });
      }
    }
    return res;
  }, [accessToken, doRefresh, persistAccessToken]);

  /** Set access token and optionally user (e.g. after Google OAuth callback). */
  const setAccessToken = useCallback((token, userData = null) => {
    setAccessTokenState(token);
    persistAccessToken(token);
    if (userData) setUser(userData);
  }, [persistAccessToken]);

  /** Google OAuth — full-page redirect (Vite /api proxy in dev, or VITE_API_URL in production). */
  const loginWithGoogle = useCallback(() => {
    if (!hasConfiguredBackend) {
      alert('Google OAuth is not configured yet. Set VITE_API_URL to your backend URL.');
      return;
    }
    let ref = '';
    try {
      ref = localStorage.getItem('referral_ref') || '';
    } catch (_) {}
    const params = new URLSearchParams();
    if (ref.trim()) params.set('ref', ref.trim().toUpperCase());
    const qs = params.toString();
    window.location.href = `${API}/auth/google${qs ? `?${qs}` : ''}`;
  }, []);

  const logout = () => {
    fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
      .finally(() => {
        setUser(null);
        setAccessTokenState(null);
        persistAccessToken(null);
        window.location.href = '/';
      });
  };

  const signIn = async (email, password) => {
    if (!hasConfiguredBackend) {
      throw new Error('Backend not configured. Please deploy your Railway backend and set VITE_API_URL in your environment.');
    }

    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error('Backend returned invalid response. Please check if the backend is running properly.');
    }

    if (!res.ok) {
      throw new Error(data.error || `Login failed (${res.status})`);
    }

    if (data.accessToken) {
      setAccessTokenState(data.accessToken);
      persistAccessToken(data.accessToken);
      setUser(data.user);
    }

    return data;
  };

  const signUp = async (email, password, name, referralCode) => {
    if (!hasConfiguredBackend) {
      throw new Error('Backend not configured. Please deploy your Railway backend and set VITE_API_URL in your environment.');
    }

    let ref = referralCode;
    if (!ref) {
      try {
        ref = localStorage.getItem('referral_ref') || '';
      } catch (_) {}
    }

    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, referralCode: ref || undefined }),
      credentials: 'include',
    });

    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error('Backend returned invalid response. Please check if the backend is running properly.');
    }

    if (!res.ok) {
      throw new Error(data.error || `Registration failed (${res.status})`);
    }

    return data;
  };

  useEffect(() => {
    if (!user) return;
    const token = sessionStorage.getItem('pendingInviteToken');
    if (!token) return;
    sessionStorage.removeItem('pendingInviteToken');
    authFetch(`${API}/invites/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [user, authFetch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        subscription,
        setUser,
        setAccessToken,
        setAccessTokenState,
        setSubscription,
        authFetch,
        loginWithGoogle,
        signInWithGoogle: loginWithGoogle,
        logout,
        signIn,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
