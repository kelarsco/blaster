import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

const SIDEBAR_DURATION_MS = 300;

export const MARKETING_NAV_LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#demo', label: 'Demo' },
  { href: '/pricing', label: 'Pricing', isRoute: true },
];

function PrimaryPillButton({ children, className = '', as: Tag = 'button', ...props }) {
  const classes = `inline-flex items-center justify-center h-9 px-4 rounded-full bg-black border border-blaster-orange text-[#faf8f5] font-poppins font-medium text-sm tracking-wide shadow-blaster-cta transition hover:opacity-90 ${className}`;
  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}

export function MarketingHeader() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    if (sidebarOpen && !sidebarClosing) {
      const t = setTimeout(() => setSidebarVisible(true), 10);
      return () => clearTimeout(t);
    }
    setSidebarVisible(false);
  }, [sidebarOpen, sidebarClosing]);

  const closeSidebar = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setSidebarClosing(true);
    setSidebarVisible(false);
    closeTimeoutRef.current = setTimeout(() => {
      setSidebarOpen(false);
      setSidebarClosing(false);
      closeTimeoutRef.current = null;
    }, SIDEBAR_DURATION_MS);
  };

  useEffect(() => () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-blaster-bg/95 backdrop-blur-sm border-b border-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-[63px] py-2 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden lg:flex items-center gap-6 xl:gap-[25px] absolute left-1/2 -translate-x-1/2">
            {MARKETING_NAV_LINKS.map((l) =>
              l.isRoute ? (
                <Link key={l.label} to={l.href} className="text-base text-black tracking-wide hover:opacity-70 transition">
                  {l.label}
                </Link>
              ) : (
                <a key={l.label} href={l.href} className="text-base text-black tracking-wide hover:opacity-70 transition">
                  {l.label}
                </a>
              )
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <PrimaryPillButton as={Link} to="/signup">
              Create account
            </PrimaryPillButton>
            <Link
              to="/login"
              className="inline-flex items-center justify-center h-9 px-4 rounded-full font-medium text-sm tracking-wide hover:bg-black/5 transition"
            >
              Login
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-black/5"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {sidebarOpen && (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm sidebar-overlay ${sidebarVisible ? 'sidebar-overlay-open' : ''} ${sidebarClosing ? 'sidebar-overlay-closing' : ''}`}
            onClick={closeSidebar}
            aria-hidden
          />
          <aside
            className={`fixed top-0 right-0 z-50 w-full max-w-sm h-full bg-white border-l shadow-xl flex flex-col sidebar-panel rounded-tl-2xl rounded-bl-2xl ${sidebarVisible ? 'sidebar-panel-open' : ''} ${sidebarClosing ? 'sidebar-panel-closing' : ''}`}
          >
            <div className="flex items-center justify-end p-4 border-b">
              <button type="button" onClick={closeSidebar} className="p-2 rounded-lg hover:bg-blaster-bg" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-4 flex flex-col">
              <div className="space-y-1">
                {MARKETING_NAV_LINKS.map((l) =>
                  l.isRoute ? (
                    <Link key={l.label} to={l.href} onClick={closeSidebar} className="block py-3 font-medium">
                      {l.label}
                    </Link>
                  ) : (
                    <a key={l.label} href={l.href} onClick={closeSidebar} className="block py-3 font-medium">
                      {l.label}
                    </a>
                  )
                )}
              </div>
              <div className="mt-auto pt-6 flex flex-col gap-3">
                <PrimaryPillButton as={Link} to="/signup" onClick={closeSidebar} className="w-full">
                  Create account
                </PrimaryPillButton>
                <Link
                  to="/login"
                  onClick={closeSidebar}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-full font-medium text-sm tracking-wide hover:bg-black/5 transition w-full"
                >
                  Login
                </Link>
              </div>
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
