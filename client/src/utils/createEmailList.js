import { API } from '../api.js';

export async function createEmailList(authFetch, { name, recipients }) {
  const res = await authFetch(`${API}/email-lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, recipients }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to save campaign list');
  return data.list;
}
