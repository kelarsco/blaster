/**
 * API base URL. In dev (Vite proxy) use relative '' so /api goes to proxy.
 * In production set VITE_API_URL to your Railway server with https, e.g. https://your-app.railway.app
 * (Must include https:// or the browser treats it as a path and requests go to your frontend domain.)
 */
const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
export const API_BASE = raw && !/^https?:\/\//i.test(raw) ? `https://${raw.replace(/^\/*/, '')}` : raw;
export const API = `${API_BASE}/api`;
