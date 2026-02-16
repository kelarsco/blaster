import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../api';

const ADMIN_API = `${API_BASE}/api/bl-admin`;
const ADMIN_TOKEN_STORAGE_KEY = 'wiblaster_admin_token';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [adminToken, setAdminTokenState] = useState(() => {
    try {
      return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  });
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const setAdminToken = useCallback((token) => {
    const value = String(token || '').trim();
    setAdminTokenState(value);
    try {
      if (value) window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, value);
      else window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch (_) {}
  }, []);

  const adminFetch = useCallback(async (path, options = {}) => {
    const url = path.startsWith('http') ? path : `${ADMIN_API}${path.startsWith('/') ? path : '/' + path}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (adminToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${adminToken}`;
    }
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });
    return res;
  }, [adminToken]);

  const refetchAdmin = useCallback(() => {
    return adminFetch('/me')
      .then((r) => {
        if (r.ok) {
          setIsAdmin(true);
          setAdminChecked(true);
          return true;
        }
        // Only clear admin state on explicit auth failure.
        if (r.status === 401 || r.status === 403) {
          setIsAdmin(false);
          setAdminToken('');
          setAdminChecked(true);
          return false;
        }
        // Keep existing admin state for transient 5xx errors.
        setAdminChecked(true);
        return isAdmin;
      })
      .catch(() => {
        // Network hiccup: do not force logout.
        setAdminChecked(true);
        return isAdmin;
      });
  }, [adminFetch, isAdmin, setAdminToken]);

  const logoutAdmin = useCallback(() => {
    setIsAdmin(false);
    setAdminChecked(true);
    setAdminToken('');
  }, [setAdminToken]);

  useEffect(() => {
    refetchAdmin();
  }, [refetchAdmin]);

  const value = {
    adminFetch,
    refetchAdmin,
    setAdminToken,
    logoutAdmin,
    isAdmin,
    adminChecked,
    adminApi: ADMIN_API,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
