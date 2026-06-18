import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from '../components/AppHeader';
import { HelpPanel } from '../components/HelpPanel';
import { SupportChatPanel } from '../components/SupportChatPanel';
import { PageTransitionWrapper } from '../components/PageTransitionWrapper';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { TrialBanner, TrialExpiredWall, isPlanUpgradeRoute } from '../components/access/PlanAccessUI.jsx';

const LAYOUT_SKELETON_MS = 1500;
const SCROLL_THRESHOLD = 10;
const NAV_TOGGLE_SIZE = 48;
const NAV_TOGGLE_EDGE = 10;
const NAV_TOGGLE_DEFAULT_LEFT = 24;
const NAV_TOGGLE_DEFAULT_BOTTOM = 154; // 124px + 30px higher
const NAV_TOGGLE_LONG_PRESS_MS = 500;
const NAV_TOGGLE_MOVE_THRESHOLD = 10;

function clampNavTogglePosition(x, y) {
  const maxX = window.innerWidth - NAV_TOGGLE_SIZE - NAV_TOGGLE_EDGE;
  const maxY = window.innerHeight - NAV_TOGGLE_SIZE - NAV_TOGGLE_EDGE;
  return {
    x: Math.max(NAV_TOGGLE_EDGE, Math.min(x, maxX)),
    y: Math.max(NAV_TOGGLE_EDGE, Math.min(y, maxY)),
  };
}

function MobileNavToggle({ open, visible, onToggle }) {
  const [pos, setPos] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    dragEnabled: false,
    longPressTimer: null,
  });

  const clearLongPressTimer = useCallback(() => {
    if (dragRef.current.longPressTimer != null) {
      clearTimeout(dragRef.current.longPressTimer);
      dragRef.current.longPressTimer = null;
    }
  }, []);

  const defaultPosition = useCallback(() => {
    return clampNavTogglePosition(
      NAV_TOGGLE_DEFAULT_LEFT,
      window.innerHeight - NAV_TOGGLE_DEFAULT_BOTTOM - NAV_TOGGLE_SIZE
    );
  }, []);

  useLayoutEffect(() => {
    setPos(defaultPosition());
    const onResize = () => {
      setPos((current) => (current ? clampNavTogglePosition(current.x, current.y) : defaultPosition()));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [defaultPosition]);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const onPointerDown = (e) => {
    if (!pos) return;
    clearLongPressTimer();
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    dragRef.current = {
      pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      dragEnabled: false,
      longPressTimer: null,
    };

    dragRef.current.longPressTimer = window.setTimeout(() => {
      if (dragRef.current.pointerId !== pointerId) return;
      dragRef.current.dragEnabled = true;
      dragRef.current.longPressTimer = null;
      setIsDragging(true);
      try {
        target.setPointerCapture(pointerId);
      } catch (_) {}
    }, NAV_TOGGLE_LONG_PRESS_MS);
  };

  const onPointerMove = (e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (!dragRef.current.dragEnabled) {
      if (Math.abs(dx) > NAV_TOGGLE_MOVE_THRESHOLD || Math.abs(dy) > NAV_TOGGLE_MOVE_THRESHOLD) {
        clearLongPressTimer();
      }
      return;
    }

    setPos(clampNavTogglePosition(dragRef.current.originX + dx, dragRef.current.originY + dy));
  };

  const finishPointer = (e, toggleOnTap) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    clearLongPressTimer();
    const wasDragging = dragRef.current.dragEnabled;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const movedFar =
      Math.abs(dx) > NAV_TOGGLE_MOVE_THRESHOLD || Math.abs(dy) > NAV_TOGGLE_MOVE_THRESHOLD;

    dragRef.current.pointerId = null;
    dragRef.current.dragEnabled = false;
    setIsDragging(false);

    if (wasDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      return;
    }

    if (toggleOnTap && !movedFar) onToggle();
  };

  const onPointerUp = (e) => finishPointer(e, true);
  const onPointerCancel = (e) => finishPointer(e, false);

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={`md:hidden fixed z-30 flex items-center justify-center w-12 h-12 rounded-full bg-black text-white shadow-lg hover:bg-gray-900 touch-manipulation select-none ${
        isDragging ? 'cursor-grabbing active:scale-100' : 'cursor-pointer active:scale-95'
      }`}
      style={{
        left: pos?.x ?? NAV_TOGGLE_DEFAULT_LEFT,
        top: pos?.y ?? 0,
        transform: visible ? 'scale(1)' : 'scale(0)',
        opacity: visible ? 1 : 0,
        transition: isDragging ? 'none' : 'transform 300ms ease-out, opacity 300ms ease-out',
        willChange: 'transform, opacity',
        pointerEvents: visible ? 'auto' : 'none',
        visibility: pos ? 'visible' : 'hidden',
      }}
      aria-label={open ? 'Close menu' : 'Open menu'}
    >
      <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

export function AppLayout() {
  const location = useLocation();
  const { status, trialExpired } = usePlanAccess();
  const [showHelp, setShowHelp] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navToggleVisible, setNavToggleVisible] = useState(true);
  const mainRef = useRef(null);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setLayoutLoading(false), LAYOUT_SKELETON_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // When route changes, scroll main content to top so the new page is visible
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  // Scroll: hide button when scrolling up, show when scrolling down (mobile). Listen to both main and window.
  useEffect(() => {
    const getScrollTop = () => {
      const el = mainRef.current;
      if (el && el.scrollHeight > el.clientHeight) return el.scrollTop;
      return typeof window !== 'undefined' ? (window.scrollY ?? document.documentElement?.scrollTop ?? 0) : 0;
    };

    const onScroll = () => {
      const st = getScrollTop();
      const delta = st - lastScrollTop.current;
      if (Math.abs(delta) < SCROLL_THRESHOLD) return;
      setNavToggleVisible(delta <= 0);
      lastScrollTop.current = st;
    };

    const mainEl = mainRef.current;
    lastScrollTop.current = getScrollTop();
    if (mainEl) mainEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const showTrialBanner = status?.trialActive && !trialExpired;

  const showTrialExpiredWall = trialExpired && !isPlanUpgradeRoute(location.pathname);

  return (
    <div className="min-h-screen flex bg-blaster-bg-app font-inter dashboard-fonts">
      {showTrialExpiredWall && <TrialExpiredWall />}
      <Sidebar
        loading={layoutLoading}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      {/* Mobile nav toggle: draggable; 10px from screen edges; tap toggles menu */}
      <MobileNavToggle
        open={sidebarOpen}
        visible={navToggleVisible && !sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />
      <div
        className={`flex-1 min-w-0 ml-0 md:ml-64 flex flex-col min-h-screen relative z-0 isolate${
          showTrialBanner ? ' app-content-with-trial-banner' : ''
        }`}
      >
        {showTrialBanner && (
          <div className="plan-trial-banner-fixed">
            <TrialBanner trialEndsAt={status.trialEndsAt} />
          </div>
        )}
        <AppHeader loading={layoutLoading} onOpenHelp={() => setShowHelp(true)} onOpenSupport={() => setShowSupport(true)} />
        <main ref={mainRef} className="flex-1 overflow-auto relative z-0 isolate">
          <div key={location.pathname} className="relative min-h-full">
            <PageTransitionWrapper>
              <Outlet />
            </PageTransitionWrapper>
          </div>
        </main>
      </div>
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {showSupport && <SupportChatPanel onClose={() => setShowSupport(false)} />}
    </div>
  );
}
