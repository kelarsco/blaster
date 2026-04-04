import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API, API_BASE } from '../api.js';
import { OAUTH_POPUP_RESULT_STORAGE_KEY } from '../utils/oauth.js';

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
  const [adminChecked, setAdminChecked] = useState(false);

  // Persist access token to localStorage
  const persistAccessToken = useCallback((token) => {
    try {
      if (token) {
        localStorage.setItem('accessToken', token);
      } else {
        localStorage.removeItem('accessToken');
      }
    } catch (_) {}
  }, []);

  // Load access token from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) setAccessTokenState(token);
    } catch (_) {}
  }, []);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          // Try to fetch user data with the stored token
          const res = await fetch(`${API}/auth/me`, {
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
          });
          
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            setAccessTokenState(token);
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('accessToken');
            setAccessTokenState(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        // Always set loading to false after initialization
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Fetch user data and subscription
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
  }, [user]);

  /** Refresh access token using refresh token from cookies. */
  const doRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) return { ok: false };
      return { ok: true, accessToken: data.accessToken, user: data.user };
    } catch (_) {
      return { ok: false };
    }
  }, []);

  /** Authenticated fetch: adds Bearer token, on 401 tries refresh once (shared lock) then retries. Never retries refresh on 429/failure. */
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
      // 429 or other refresh failure: do not retry refresh, return original 401
    }
    return res;
  }, [accessToken, doRefresh, persistAccessToken]);

  /** Set access token and optionally user (e.g. after Google OAuth callback). */
  const setAccessToken = useCallback((token, userData = null) => {
    setAccessTokenState(token);
    persistAccessToken(token);
    if (userData) setUser(userData);
  }, [persistAccessToken]);

  /** Open Google OAuth in a popup when possible; fallback to full-page redirect. */
  const loginWithGoogle = useCallback(() => {
    // Check if API_BASE is configured
    if (!API_BASE || API_BASE === '') {
      alert('Google OAuth is not configured yet. Please:\n1. Deploy your Railway backend\n2. Set VITE_API_URL in your environment\n3. Configure Google OAuth in Railway');
      return;
    }

    const url = `${API}/auth/google`;
    let handled = false;

    const finishOauth = (token) => {
      if (!token || handled) return;
      handled = true;
      setAccessToken(token);
      fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((userData) => {
          if (userData) {
            setUser(userData);
            window.location.href = '/app/dashboard';
            return;
          }
          window.location.href = '/login?error=google_failed';
        })
        .catch(() => {
          // On failure just go to login; user can retry
          window.location.href = '/login?error=google_failed';
        });
    };

    // Try popup first
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const popup = window.open(
      url,
      'google-login',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    // If popup was blocked, fallback to full redirect
    if (!popup) {
      window.location.href = url;
      return;
    }

    let popupClosedPoll = null;
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (popupClosedPoll) {
        window.clearInterval(popupClosedPoll);
        popupClosedPoll = null;
      }
    };

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === 'oauth-success' && data.token) {
        cleanup();
        try {
          popup.close();
        } catch (_) {}
        finishOauth(data.token);
      } else if (data.type === 'oauth-error') {
        cleanup();
        try {
          popup.close();
        } catch (_) {}
        const msg = data.message ? encodeURIComponent(data.message) : '';
        window.location.href = `/login?error=google_failed&message=${msg}`;
      }
    };

    const handleStorage = (event) => {
      if (event.key !== OAUTH_POPUP_RESULT_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        if (payload?.type === 'oauth-success' && payload?.token) {
          cleanup();
          try {
            popup.close();
          } catch (_) {}
          finishOauth(payload.token);
        } else if (payload?.type === 'oauth-error') {
          cleanup();
          try {
            popup.close();
          } catch (_) {}
          const msg = payload?.message ? encodeURIComponent(payload.message) : '';
          window.location.href = `/login?error=google_failed&message=${msg}`;
        }
      } catch (_) {
        // Ignore malformed storage payloads.
      } finally {
        try {
          localStorage.removeItem(OAUTH_POPUP_RESULT_STORAGE_KEY);
        } catch (_) {}
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    // If popup was blocked from opener, it may close without messaging parent.
    popupClosedPoll = window.setInterval(() => {
      if (!popup.closed || handled) return;
      cleanup();
      // Final fallback: move to full-page OAuth flow so login can still complete.
      window.location.href = url;
    }, 500);
  }, [setAccessToken, setUser]);

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
    try {
      // Check if API_BASE is configured
      if (!API_BASE || API_BASE === '') {
        throw new Error('Backend not configured. Please deploy your Railway backend and set VITE_API_URL in your environment.');
      }

      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      if (data.accessToken) {
        setAccessTokenState(data.accessToken);
        persistAccessToken(data.accessToken);
        setUser(data.user);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email, password, name) => {
    try {
      // Check if API_BASE is configured
      if (!API_BASE || API_BASE === '') {
        throw new Error('Backend not configured. Please deploy your Railway backend and set VITE_API_URL in your environment.');
      }

      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      if (data.accessToken) {
        setAccessTokenState(data.accessToken);
        persistAccessToken(data.accessToken);
        setUser(data.user);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  };

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
        logout,
        signIn,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
