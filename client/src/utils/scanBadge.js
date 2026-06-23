const SCAN_BADGE_KEY = 'wiblaster-nav-scan-badge';
export const NAV_BADGE_EVENT = 'wiblaster:nav-badge-update';

export function setScanBadgePending() {
  try {
    window.localStorage.setItem(SCAN_BADGE_KEY, '1');
    window.dispatchEvent(new Event(NAV_BADGE_EVENT));
  } catch (_) {}
}

export function clearScanBadgePending() {
  try {
    window.localStorage.removeItem(SCAN_BADGE_KEY);
    window.dispatchEvent(new Event(NAV_BADGE_EVENT));
  } catch (_) {}
}

export function isScanBadgePending() {
  try {
    return window.localStorage.getItem(SCAN_BADGE_KEY) === '1';
  } catch {
    return false;
  }
}
