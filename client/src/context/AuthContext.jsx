import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  /** Try to restore session via refresh token (cookie). Runs once on mount. */
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.user && data?.accessToken) {
          setUser(data.user);
          setAccessTokenState(data.accessToken);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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

  /** Authenticated fetch: adds Bearer token, on 401 tries refresh once then retries. */
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = { ...options.headers };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let res = await fetch(url, { ...options, credentials: 'include', headers });
    if (res.status === 401) {
      const refreshRes = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setUser(data.user);
        setAccessTokenState(data.accessToken);
        const newToken = data.accessToken;
        if (newToken) {
          const retryHeaders = { ...options.headers, Authorization: `Bearer ${newToken}` };
          res = await fetch(url, { ...options, credentials: 'include', headers: retryHeaders });
        }
      }
    }
    return res;
  }, [accessToken]);

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
