const KEY_PREFIX = 'wiblaster-priority-dismissed';

function storageKey(userId) {
  return `${KEY_PREFIX}:${userId || 'anon'}`;
}

export function isPriorityVideoDismissed(userId, resourceId) {
  if (!userId || !resourceId) return false;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) && ids.includes(resourceId);
  } catch {
    return false;
  }
}

export function markPriorityVideoDismissed(userId, resourceId) {
  if (!userId || !resourceId) return;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed) ? parsed : [];
    if (!ids.includes(resourceId)) ids.push(resourceId);
    window.localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
