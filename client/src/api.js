/**
 * API base URL. In dev (Vite proxy) use relative '' so /api goes to proxy.
 * In production (Vercel) set VITE_API_URL to your Railway server, e.g. https://your-app.railway.app
 *
 * For authenticated requests, use useAuth().authFetch(url, options) so the access token
 * is sent and 401 triggers a refresh and retry.
 */
export const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
export const API = `${API_BASE}/api`;
