import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

  // Simple admin validation based on token presence
  const refetchAdmin = useCallback(() => {
    return new Promise((resolve) => {
      if (adminToken && adminToken.startsWith('admin_token_')) {
        setIsAdmin(true);
        setAdminChecked(true);
        resolve(true);
      } else {
        setIsAdmin(false);
        setAdminChecked(true);
        resolve(false);
      }
    });
  }, [adminToken]);

  const adminFetch = useCallback(async (path, options = {}) => {
    // Since we don't have a backend, we'll simulate admin API calls
    console.log('Admin API call simulated:', path, options);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }, []);

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
