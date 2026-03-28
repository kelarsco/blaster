import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { supabaseAdminAPI } from '../utils/supabase-admin';
import { Logo } from '../components/Logo.jsx';

const LAST_SEEN_KEY = 'bl_admin_sidebar_last_seen';

const navItems = [
  { to: '/bl-admin/overview', label: 'Overview', end: true },
  { to: '/bl-admin/users', label: 'Users', end: false, countKey: 'users' },
  { to: '/bl-admin/subscriptions', label: 'Subscriptions', end: false, countKey: 'subscriptions' },
  { to: '/bl-admin/messages', label: 'Messages', end: false, countKey: 'messages' },
];

function getLastSeen() {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage.getItem(LAST_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      users: Number(parsed.users) || 0,
      subscriptions: Number(parsed.subscriptions) || 0,
      messages: Number(parsed.messages) || 0,
    };
  } catch (_) {
    return { users: 0, subscriptions: 0, messages: 0 };
  }
}

function setLastSeen(key, value) {
  try {
    const prev = getLastSeen();
    prev[key] = value;
    if (typeof window !== 'undefined') window.localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(prev));
  } catch (_) {}
}

function LayoutIcon({ name }) {
  const icons = {
    overview: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    subscriptions: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    messages: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  };
  return icons[name] || icons.overview;
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminFetch, logoutAdmin } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counts, setCounts] = useState({ users: 0, subscriptions: 0, messages: 0 });
  const [lastSeen, setLastSeenState] = useState(getLastSeen);

  useEffect(() => {
    setLastSeenState(getLastSeen());
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const counts = await supabaseAdminAPI.getSidebarCounts();
      setCounts(counts);
    } catch (error) {
      console.error('Error fetching admin counts:', error);
      // Set default counts on error
      setCounts({ users: 0, subscriptions: 0, messages: 0 });
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 120000); // 2 minutes instead of 1 minute
    return () => clearInterval(interval);
  }, [fetchCounts]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/bl-admin/users')) {
      setLastSeen('users', counts.users);
      setLastSeenState((prev) => ({ ...prev, users: counts.users }));
    } else if (path.startsWith('/bl-admin/subscriptions')) {
      setLastSeen('subscriptions', counts.subscriptions);
      setLastSeenState((prev) => ({ ...prev, subscriptions: counts.subscriptions }));
    } else if (path.startsWith('/bl-admin/messages')) {
      setLastSeen('messages', counts.messages);
      setLastSeenState((prev) => ({ ...prev, messages: counts.messages }));
    }
  }, [location.pathname, counts.users, counts.subscriptions, counts.messages]);

  const hasUpdate = {
    users: counts.users > lastSeen.users,
    subscriptions: counts.subscriptions > lastSeen.subscriptions,
    messages: counts.messages > lastSeen.messages,
  };

  const logout = async () => {
    try {
      // No need to call logout API since we're using Supabase auth directly
      logoutAdmin();
      navigate('/bl-admin/login', { replace: true });
      window.location.reload();
    } catch (_) {}
  };

  return (
    <div className="min-h-screen flex bg-blaster-bg-app">
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-30 h-screen w-64 bg-blaster-sidebar border-r border-blaster-border flex flex-col transform transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-blaster-border">
          <div className="flex items-center gap-2 text-blaster-fg font-semibold text-lg">
            <Logo />
            <span>Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, label, end, countKey }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blaster-sidebar-hover text-blaster-fg' : 'text-blaster-muted hover:bg-blaster-sidebar-hover hover:text-blaster-fg'
                }`
              }
            >
              <LayoutIcon name={to.split('/').pop()} />
              <span className="flex-1 text-left">{label}</span>
              {countKey && hasUpdate[countKey] && (
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden title="New updates" />
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-blaster-border">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blaster-muted hover:bg-blaster-sidebar-hover hover:text-blaster-fg w-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 md:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b border-blaster-border bg-blaster-bg-app">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-blaster-fg hover:bg-blaster-border/50"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-blaster-muted text-sm font-medium">Admin</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
