import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PagePreloader } from './PagePreloader';
import { PageSkeleton } from './PageSkeleton';

const PRELOADER_MS = 200;
const SKELETON_MS_FIRST = 800;
const SKELETON_MS_NAV = 150;

export function PageTransitionWrapper({ children }) {
  const location = useLocation();
  const [showPreloader, setShowPreloader] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const prevPathRef = useRef(null);

  useEffect(() => {
    const isFirstLoad = prevPathRef.current === null;
    const isRouteChange = prevPathRef.current !== null && location.pathname !== prevPathRef.current;
    prevPathRef.current = location.pathname;

    if (isFirstLoad || isRouteChange) {
      setShowPreloader(true);
      setShowSkeleton(true);
    }

    const preloaderTimer = setTimeout(() => setShowPreloader(false), PRELOADER_MS);
    const skeletonMs = isFirstLoad ? SKELETON_MS_FIRST : SKELETON_MS_NAV;
    const skeletonTimer = setTimeout(() => setShowSkeleton(false), skeletonMs);

    return () => {
      clearTimeout(preloaderTimer);
      clearTimeout(skeletonTimer);
    };
  }, [location.pathname]);

  return (
    <>
      {showPreloader && <PagePreloader />}
      {showSkeleton && (
        <div className="absolute inset-0 z-10 bg-blaster-bg-app">
          <PageSkeleton />
        </div>
      )}
      {children}
    </>
  );
}
