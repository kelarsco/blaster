import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../api.js';

const AuthContext = createContext(null);
const ACCESS_TOKEN_STORAGE_KEY = 'wiblaster_access_token';
const OAUTH_POPUP_RESULT_STORAGE_KEY = 'wiblaster_oauth_popup_result';

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshPromiseRef = useRef(null);

  const persistAccessToken = useCallback((token) => {
    try {
      if (token) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
      else localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    } catch (_) {
      // Ignore storage errors (private mode, blocked storage).
    }
  }, []);

  /** Single refresh in flight; others wait for it. Prevents 429 from parallel refresh calls. */
  const doRefresh = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const p = fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 403 && data?.code === 'SUSPENDED') {
          return { status: 403, suspended: true, data };
        }
        if (r.ok && data?.user && data?.accessToken) return { ok: true, user: data.user, accessToken: data.accessToken };
        return { status: r.status, ok: false };
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });
    refreshPromiseRef.current = p;
    return p;
  }, []);

  /** Try to restore session from stored access token, then fallback to refresh token cookie. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let restored = false;
        let storedToken = null;
        try {
          storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
        } catch (_) {}
        if (storedToken) {
          const meRes = await fetch(`${API}/auth/me`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${storedToken}` },
            credentials: 'include',
          });
          if (meRes.ok) {
            const me = await meRes.json().catch(() => null);
            if (me?.id) {
              restored = true;
              if (!cancelled) {
                setUser(me);
                setAccessTokenState(storedToken);
              }
            }
          } else {
            persistAccessToken(null);
          }
        }
        if (!restored) {
          const result = await doRefresh();
          if (cancelled) return;
          if (result?.suspended) {
            setUser(null);
            setAccessTokenState(null);
            persistAccessToken(null);
            const msg = encodeURIComponent(result.data?.error || 'Account suspended.');
            window.location.href = `/login?error=suspended&message=${msg}`;
            return;
          }
          if (result?.ok && result.user && result.accessToken) {
            setUser(result.user);
            setAccessTokenState(result.accessToken);
            persistAccessToken(result.accessToken);
            
            // Fetch subscription data
            fetch(`${API}/billing/subscription`, {
              headers: { 'Authorization': `Bearer ${result.accessToken}` }
            })
              .then(r => r.json())
              .then(data => {
                if (data.subscription) {
                  setSubscription(data.subscription);
                }
              })
              .catch(() => {
                // Ignore subscription fetch errors
              });
          }
        }
      } catch (_) {
        // Keep unauthenticated state when restore fails.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [doRefresh, persistAccessToken]);

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
