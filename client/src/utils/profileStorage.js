/** @deprecated Legacy global keys — do not use for new reads/writes */
export const PROFILE_KEY = 'wiblaster-profile';
export const PROFILE_IMAGE_KEY = 'wiblaster-profile-image';

function profileStorageKey(userId) {
  return `wiblaster-profile-${userId}`;
}

function profileImageStorageKey(userId) {
  return `wiblaster-profile-image-${userId}`;
}

export function loadProfileFromStorage(userId) {
  if (!userId || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { firstName: '', lastName: '' };
  }
  try {
    const raw = localStorage.getItem(profileStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // ignore
  }
  return { firstName: '', lastName: '' };
}

export function saveProfileToStorage(userId, profile) {
  if (!userId || typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(profileStorageKey(userId), JSON.stringify(profile));
  } catch (_) {
    // ignore
  }
}

export function loadProfileImageFromStorage(userId) {
  if (!userId || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(profileImageStorageKey(userId)) || null;
  } catch (_) {
    // ignore
  }
  return null;
}

export function saveProfileImageToStorage(userId, dataUrl) {
  if (!userId || typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(profileImageStorageKey(userId), dataUrl);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profileImageUpdated', { detail: { userId } }));
    }
  } catch (_) {
    // ignore
  }
}

export function clearProfileImageFromStorage(userId) {
  if (!userId || typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(profileImageStorageKey(userId));
  } catch (_) {
    // ignore
  }
}
