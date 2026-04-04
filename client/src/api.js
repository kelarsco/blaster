/**
 * API base URL. In dev (Vite proxy) use relative '' so /api goes to proxy.
 * In production set VITE_API_URL to your deployed backend with https, e.g. https://your-app.up.railway.app
 * (Must include https:// or the browser treats it as a path and requests go to your frontend domain.)
 */
const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
const normalized = raw.trim().replace(/\/+$/, '');
export const API_BASE = normalized && !/^https?:\/\//i.test(normalized) ? `https://${normalized.replace(/^\/*/, '')}` : normalized;
export const API = `${API_BASE}/api`;

// API client with authentication
export const apiClient = {
  // Auth endpoints
  login: (email, password) => {
    return fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
  },

  register: (email, password, name) => {
    return fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    });
  },

  refresh: () => {
    return fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  },

  logout: () => {
    return fetch(`${API}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  me: (token) => {
    return fetch(`${API}/auth/me`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
    });
  },

  googleAuth: () => {
    return `${API}/auth/google`;
  },

  // Scan endpoints
  startScan: (data, token) => {
    return fetch(`${API}/scan/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
      credentials: 'include',
    });
  },

  getScanStatus: (scanId, token) => {
    return fetch(`${API}/scan/status/${scanId}`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
    });
  },

  getScans: (token) => {
    return fetch(`${API}/scans`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
    });
  },

  // Billing endpoints
  getSubscription: (userId, token) => {
    return fetch(`${API}/billing/subscription`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
    });
  },

  initializePayment: (data, token) => {
    return fetch(`${API}/billing/initialize`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
      credentials: 'include',
    });
  },

  // Admin endpoints
  adminAuth: (totpCode) => {
    return fetch(`${API}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totpCode }),
    });
  },

  adminData: (token) => {
    return fetch(`${API}/admin/data`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
  },
};

// Default export for backward compatibility
export default apiClient;
