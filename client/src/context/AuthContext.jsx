import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../api.js';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && (data.email || data.dev)) setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const login = () => {
    window.location.href = `${API}/auth/google`;
  };

  const logout = () => {
    fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
      .then(() => setUser(null))
      .then(() => { window.location.href = '/'; });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
