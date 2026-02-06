export const PROFILE_KEY = 'wiblaster-profile';
export const PROFILE_IMAGE_KEY = 'wiblaster-profile-image';

export function loadProfileFromStorage() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { firstName: '', lastName: '' };
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // ignore
  }
  return { firstName: '', lastName: '' };
}

export function loadProfileImageFromStorage() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(PROFILE_IMAGE_KEY) || null;
  } catch (_) {
    // ignore
  }
  return null;
}

