import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API } from '../api.js';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const refetchAdmin = useCallback(async () => {
    try {
      const res = await fetch(`${API}/bl-admin/me`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setIsAdmin(true);
        setAdminChecked(true);
        return true;
      }
      setIsAdmin(false);
      setAdminChecked(true);
      return false;
    } catch (_) {
      setIsAdmin(false);
      setAdminChecked(true);
      return false;
    }
  }, []);

  const adminFetch = useCallback(async (path, options = {}) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = path.startsWith('http') ? path : `${API}/bl-admin${normalizedPath}`;
    const headers = { ...options.headers };
    if (!headers['Content-Type'] && options.body) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, credentials: 'include', headers });
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await fetch(`${API}/bl-admin/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (_) {}
    setIsAdmin(false);
    setAdminChecked(true);
  }, []);

  useEffect(() => {
    refetchAdmin();
  }, [refetchAdmin]);

  const value = {
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
