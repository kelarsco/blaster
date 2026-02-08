import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../api.js';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshPromiseRef = useRef(null);

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

  /** Try to restore session via refresh token (cookie). Runs once on mount. No retry on failure. */
  useEffect(() => {
    let cancelled = false;
    doRefresh()
      .then((result) => {
        if (cancelled) return;
        if (result?.suspended) {
          setUser(null);
          setAccessTokenState(null);
          const msg = encodeURIComponent(result.data?.error || 'Account suspended.');
          window.location.href = `/login?error=suspended&message=${msg}`;
          return;
        }
        if (result?.ok && result.user && result.accessToken) {
          setUser(result.user);
          setAccessTokenState(result.accessToken);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [doRefresh]);

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
        const msg = encodeURIComponent(refreshResult.data?.error || 'Account suspended.');
        window.location.href = `/login?error=suspended&message=${msg}`;
        return res;
      }
      if (refreshResult?.ok && refreshResult.accessToken) {
        setUser(refreshResult.user);
        setAccessTokenState(refreshResult.accessToken);
        const retryHeaders = { ...options.headers, Authorization: `Bearer ${refreshResult.accessToken}` };
        res = await fetch(url, { ...options, credentials: 'include', headers: retryHeaders });
      }
      // 429 or other refresh failure: do not retry refresh, return original 401
    }
    return res;
  }, [accessToken, doRefresh]);

  /** Set access token and optionally user (e.g. after Google OAuth callback). */
  const setAccessToken = useCallback((token, userData = null) => {
    setAccessTokenState(token);
    if (userData) setUser(userData);
  }, []);

  const loginWithGoogle = () => {
    window.location.href = `${API}/auth/google`;
  };

  const logout = () => {
    fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
      .finally(() => {
        setUser(null);
        setAccessTokenState(null);
        window.location.href = '/';
      });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        setUser,
        setAccessToken,
        setAccessTokenState,
        authFetch,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
