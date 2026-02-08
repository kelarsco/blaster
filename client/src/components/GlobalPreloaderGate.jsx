import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GlobalPreloader } from './GlobalPreloader';

/**
 * Shows the global circle preloader (with fade out) on all pages except the dashboard (/app/*).
 * Dashboard keeps its own preloader in AppLayout / PageTransitionWrapper.
 */
export function GlobalPreloaderGate({ children }) {
  const location = useLocation();
  const [showPreloader, setShowPreloader] = useState(false);

  useEffect(() => {
    if (!location.pathname.startsWith('/app')) {
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
