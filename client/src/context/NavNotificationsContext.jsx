import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { API } from '../api.js';
import {
  clearScanBadgePending,
  isScanBadgePending,
  NAV_BADGE_EVENT,
} from '../utils/scanBadge.js';

const NavNotificationsContext = createContext(null);

const ROUTE_BADGE_KEYS = {
  '/app/referral': 'referral',
  '/app/resources': 'resources',
  '/app/scanner': 'scanner',
};

export function NavNotificationsProvider({ children }) {
  const { user, authFetch } = useAuth();
  const location = useLocation();
  const [badges, setBadges] = useState({ referral: false, resources: false, scanner: false });
  const [priorityVideo, setPriorityVideo] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const syncScannerBadge = useCallback(() => {
    setBadges((prev) => ({ ...prev, scanner: isScanBadgePending() }));
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !authFetch) {
      setBadges({ referral: false, resources: false, scanner: false });
      setPriorityVideo(null);
      setLoaded(true);
      return;
    }
    try {
      const res = await authFetch(`${API}/user/notifications`);
      if (!res.ok) return;
      const data = await res.json();
      setBadges({
        referral: Boolean(data?.badges?.referral),
        resources: Boolean(data?.badges?.resources),
        scanner: isScanBadgePending(),
      });
      setPriorityVideo(data?.priorityVideo || null);
    } catch (_) {
      syncScannerBadge();
    } finally {
      setLoaded(true);
    }
  }, [user, authFetch, syncScannerBadge]);

  const markSeen = useCallback(
    async (key) => {
      if (key === 'scanner') {
        clearScanBadgePending();
        setBadges((prev) => ({ ...prev, scanner: false }));
        return;
      }
      if (!authFetch) return;
      try {
        await authFetch(`${API}/user/notifications/seen`, {
          method: 'POST',
          body: JSON.stringify({ key }),
        });
      } catch (_) {}
      setBadges((prev) => ({ ...prev, [key]: false }));
    },
    [authFetch]
  );

  const dismissPriorityVideo = useCallback(
    async (resourceId) => {
      const id = resourceId || priorityVideo?.id;
      if (!id) return;
      setPriorityVideo(null);
      if (!authFetch) return;
      try {
        await authFetch(`${API}/user/notifications/dismiss-priority`, {
          method: 'POST',
          body: JSON.stringify({ resourceId: id }),
        });
      } catch (_) {}
    },
    [authFetch, priorityVideo?.id]
  );

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const onBadgeUpdate = () => syncScannerBadge();
    window.addEventListener(NAV_BADGE_EVENT, onBadgeUpdate);
    return () => window.removeEventListener(NAV_BADGE_EVENT, onBadgeUpdate);
  }, [syncScannerBadge]);

  useEffect(() => {
    const path = location.pathname;
    for (const [route, key] of Object.entries(ROUTE_BADGE_KEYS)) {
      if (path === route || path.startsWith(`${route}/`)) {
        markSeen(key);
        break;
      }
    }
  }, [location.pathname, markSeen]);

  const value = useMemo(
    () => ({
      badges,
      priorityVideo,
      loaded,
      refresh,
      markSeen,
      dismissPriorityVideo,
    }),
    [badges, priorityVideo, loaded, refresh, markSeen, dismissPriorityVideo]
  );

  return (
    <NavNotificationsContext.Provider value={value}>{children}</NavNotificationsContext.Provider>
  );
}

export function useNavNotifications() {
  const ctx = useContext(NavNotificationsContext);
  if (!ctx) {
    throw new Error('useNavNotifications must be used within NavNotificationsProvider');
  }
  return ctx;
}
