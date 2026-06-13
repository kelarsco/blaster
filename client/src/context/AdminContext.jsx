import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API } from '../api.js';

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

  const refetchAdmin = useCallback(async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
      const res = await fetch(`${API}/bl-admin/me`, {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        setIsAdmin(true);
        setAdminChecked(true);
        return true;
      }
      setIsAdmin(false);
      setAdminChecked(true);
      if (adminToken) setAdminToken('');
      return false;
    } catch (_) {
      setIsAdmin(false);
      setAdminChecked(true);
      return false;
    }
  }, [adminToken, setAdminToken]);

  const adminFetch = useCallback(async (path, options = {}) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = path.startsWith('http') ? path : `${API}/bl-admin${normalizedPath}`;
    const headers = { ...options.headers };
    if (!headers['Content-Type'] && options.body) {
      headers['Content-Type'] = 'application/json';
    }
    if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
    return fetch(url, { ...options, credentials: 'include', headers });
  }, [adminToken]);

  const logoutAdmin = useCallback(async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
      await fetch(`${API}/bl-admin/logout`, { method: 'POST', credentials: 'include', headers });
    } catch (_) {}
    setIsAdmin(false);
    setAdminChecked(true);
    setAdminToken('');
  }, [adminToken, setAdminToken]);

  useEffect(() => {
    refetchAdmin();
  }, [refetchAdmin]);

  const value = {
    adminToken,
    setAdminToken,
    adminFetch,
    refetchAdmin,
    logoutAdmin,
    isAdmin,
    adminChecked,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
