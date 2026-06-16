/**
 * API base URL. In dev (Vite proxy) use relative '' so /api goes to proxy.
 * In production set VITE_API_URL to your deployed backend with https, e.g. https://your-app.up.railway.app
 */
const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
const normalized = raw.trim().replace(/\/+$/, '');
export const API_BASE = normalized && !/^https?:\/\//i.test(normalized) ? `https://${normalized.replace(/^\/*/, '')}` : normalized;
export const API = `${API_BASE}/api`;

/** Vite dev proxy serves /api — works on localhost and dev tunnels without VITE_API_URL */
export const usesDevApiProxy = Boolean(import.meta.env?.DEV) && !API_BASE;
export const hasConfiguredBackend = Boolean(API_BASE) || usesDevApiProxy;
