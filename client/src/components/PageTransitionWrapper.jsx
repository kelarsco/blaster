import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { hasRouteCache } from '../utils/pageCache.js';
import { PagePreloader } from './PagePreloader';
import { PageSkeleton } from './PageSkeleton';

const PRELOADER_MS = 200;
const SKELETON_MS_FIRST = 800;
const SKELETON_MS_NAV = 150;

export function PageTransitionWrapper({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const [showPreloader, setShowPreloader] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const prevPathRef = useRef(null);

  useEffect(() => {
    const isFirstLoad = prevPathRef.current === null;
    const isRouteChange = prevPathRef.current !== null && location.pathname !== prevPathRef.current;
    prevPathRef.current = location.pathname;

    const hasCache = hasRouteCache(user?.id, location.pathname);

    if (isFirstLoad || isRouteChange) {
      if (hasCache) {
        setShowPreloader(false);
        setShowSkeleton(false);
      } else {
        setShowPreloader(true);
        setShowSkeleton(true);
      }
    }

    if (hasCache) return undefined;

    const preloaderTimer = window.setTimeout(() => setShowPreloader(false), PRELOADER_MS);
    const skeletonMs = isFirstLoad ? SKELETON_MS_FIRST : SKELETON_MS_NAV;
    const skeletonTimer = window.setTimeout(() => setShowSkeleton(false), skeletonMs);

    return () => {
      window.clearTimeout(preloaderTimer);
      window.clearTimeout(skeletonTimer);
    };
  }, [location.pathname, user?.id]);

  return (
    <>
      {showPreloader && <PagePreloader />}
      {showSkeleton && (
        <div className="absolute inset-0 z-10 bg-blaster-bg-app">
          <PageSkeleton />
        </div>
      )}
      <div className={showSkeleton ? 'opacity-0' : 'opacity-100 transition-opacity duration-150'}>
        {children}
      </div>
    </>
  );
}
