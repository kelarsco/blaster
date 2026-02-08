import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GlobalPreloader } from './GlobalPreloader';

/**
 * Shows the global circle preloader (with fade out) on all pages except the dashboard (/app/*) and admin (/bl-admin/*).
 * Dashboard keeps its own preloader; admin pages use in-page skeleton loaders only.
 */
export function GlobalPreloaderGate({ children }) {
  const location = useLocation();
  const [showPreloader, setShowPreloader] = useState(false);

  useEffect(() => {
    const isDashboard = location.pathname.startsWith('/app');
    const isAdmin = location.pathname.startsWith('/bl-admin');
    if (!isDashboard && !isAdmin) {
      setShowPreloader(true);
    }
  }, [location.pathname]);

  return (
    <>
      <GlobalPreloader
        visible={showPreloader}
        onFadeComplete={() => setShowPreloader(false)}
      />
      {children}
    </>
  );
}
