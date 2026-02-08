import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
const ADMIN_API = `${API_BASE}/api/bl-admin`;

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const adminFetch = useCallback(async (path, options = {}) => {
    const url = path.startsWith('http') ? path : `${ADMIN_API}${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    return res;
  }, []);

  const refetchAdmin = useCallback(() => {
    return adminFetch('/me')
      .then((r) => {
        setIsAdmin(r.ok);
        setAdminChecked(true);
        return r.ok;
      })
      .catch(() => {
        setIsAdmin(false);
        setAdminChecked(true);
        return false;
      });
  }, [adminFetch]);

  useEffect(() => {
    refetchAdmin();
  }, [refetchAdmin]);

  const value = {
    adminFetch,
    refetchAdmin,
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
