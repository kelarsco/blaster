import React, { useState, useEffect, useRef } from 'react';
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
const NAV_TOGGLE_DEFAULT_LEFT = 24;
const NAV_TOGGLE_DEFAULT_BOTTOM = 154;

function MobileNavToggle({ open, visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="md:hidden fixed z-30 flex items-center justify-center w-[53px] h-[53px] rounded-full bg-black text-white shadow-lg hover:bg-gray-900 touch-manipulation cursor-pointer active:scale-95"
      style={{
        left: NAV_TOGGLE_DEFAULT_LEFT,
        bottom: NAV_TOGGLE_DEFAULT_BOTTOM,
        transform: visible ? 'scale(1)' : 'scale(0)',
        opacity: visible ? 1 : 0,
        transition: 'transform 300ms ease-out, opacity 300ms ease-out',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      aria-label={open ? 'Close menu' : 'Open menu'}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      {/* Mobile nav toggle: fixed bottom-left; tap opens menu */}
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
