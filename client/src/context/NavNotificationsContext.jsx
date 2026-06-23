import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { API } from '../api.js';
import {
  clearScanBadgePending,
  isScanBadgePending,
  NAV_BADGE_EVENT,
} from '../utils/scanBadge.js';
import {
  isPriorityVideoDismissed,
  markPriorityVideoDismissed,
} from '../utils/priorityToastStorage.js';

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
      const pv = data?.priorityVideo || null;
      if (pv?.id && isPriorityVideoDismissed(user.id, pv.id)) {
        setPriorityVideo(null);
      } else {
        setPriorityVideo(pv);
      }
    } catch (_) {
      syncScannerBadge();
    } finally {
      setLoaded(true);
    }
  }, [user, authFetch, syncScannerBadge]);

  const dismissPriorityVideo = useCallback(
    async (resourceId) => {
      const id = resourceId || priorityVideo?.id;
      if (!id) return;
      setPriorityVideo(null);
      if (user?.id) markPriorityVideoDismissed(user.id, id);
      if (!authFetch) return;
      try {
        await authFetch(`${API}/user/notifications/dismiss-priority`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId: id }),
        });
      } catch (_) {}
    },
    [authFetch, priorityVideo?.id, user?.id]
  );

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
      } catch (_) {}
      setBadges((prev) => ({ ...prev, [key]: false }));
    },
    [authFetch]
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
    if (path === '/app/resources' || path.startsWith('/app/resources/')) {
      markSeen('resources');
      if (priorityVideo?.id) {
        dismissPriorityVideo(priorityVideo.id);
      }
      return;
    }
    for (const [route, key] of Object.entries(ROUTE_BADGE_KEYS)) {
      if (route === '/app/resources') continue;
      if (path === route || path.startsWith(`${route}/`)) {
        markSeen(key);
        break;
      }
    }
  }, [location.pathname, markSeen, dismissPriorityVideo, priorityVideo?.id]);

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
