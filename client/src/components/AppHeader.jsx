import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadProfileFromStorage, loadProfileImageFromStorage } from '../utils/profileStorage';

function ProfileIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-blaster-border/60 ${className}`} />;
}

const dropdownItems = [
  { label: 'Account', to: '/app/account' },
  { label: 'Pricing plan', to: '/app/account/pricing' },
  { label: 'Support', to: '#' },
  { label: 'Log out', action: 'logout' },
];

export function AppHeader({ loading, onOpenHelp }) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profile, setProfile] = useState(() => loadProfileFromStorage());
  const [profileImage, setProfileImage] = useState(() => loadProfileImageFromStorage());
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    setProfile(loadProfileFromStorage());
    setProfileImage(loadProfileImageFromStorage());
    setImageError(false);
  }, [user?.id, user?.picture]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function onFocus() {
      setProfile(loadProfileFromStorage());
      setProfileImage(loadProfileImageFromStorage());
    }
    function onProfileImageUpdated() {
      setProfileImage(loadProfileImageFromStorage());
      setImageError(false);
    }
    window.addEventListener('focus', onFocus);
    window.addEventListener('profileImageUpdated', onProfileImageUpdated);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('profileImageUpdated', onProfileImageUpdated);
    };
  }, []);

  const refreshProfileFromStorage = () => {
    setProfile(loadProfileFromStorage());
    setProfileImage(loadProfileImageFromStorage());
    setImageError(false);
  };

  const displayEmail = user?.email || 'wiblaster';
  const authName = (user?.name || '').trim();
  const profileFirst = (profile?.firstName || '').trim();
  const profileLast = (profile?.lastName || '').trim();
  const profileName = [profileFirst, profileLast].filter(Boolean).join(' ');
  const displayName = profileName || authName || displayEmail.split('@')[0] || 'Account';
  const googlePicture = user?.picture && !imageError ? user.picture : null;
  const avatarUrl = profileImage || googlePicture;

  return (
    <header className="sticky top-0 z-20 flex flex-col bg-white border-b border-blaster-border shrink-0">
      <div className="flex items-center justify-between md:justify-end gap-4 px-6 py-4 h-[62px]">
        {/* Logo: mobile only; desktop has it in sidebar */}
        <Link
          to="/app/dashboard"
          className="flex md:hidden items-center gap-2 text-blaster-fg font-semibold text-lg shrink-0"
        >
          <span className="text-blaster-accent">⚡</span>
          wiblaster
        </Link>
        {/* Help + Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <>
              <Skeleton className="h-10 w-[62px] rounded-lg" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenHelp && setTimeout(onOpenHelp, 1000)}
                className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-gray-50 text-sm font-medium transition"
              >
                Help
              </button>
              <div className="relative">
                <button
                  ref={buttonRef}
                  type="button"
                  onClick={() => {
                    refreshProfileFromStorage();
                    setDropdownOpen((o) => !o);
                  }}
                  className="w-10 h-10 rounded-full bg-teal-700 hover:bg-teal-800 flex items-center justify-center overflow-hidden transition shadow-sm"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                  aria-label="Account menu"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <ProfileIcon />
                  )}
                </button>

                {dropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white border border-gray-200 shadow-xl py-2 z-30"
                role="menu"
              >
                {/* User block */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-teal-700 flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <ProfileIcon />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-blaster-fg truncate">{displayName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                        Owner
                      </span>
                    </div>
                    <p className="text-sm text-blaster-muted truncate mt-0.5">{displayEmail}</p>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {dropdownItems.map((item) => {
                    if (item.action === 'logout') {
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            logout();
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-blaster-fg hover:bg-gray-50 transition"
                          role="menuitem"
                        >
                          {item.label}
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2.5 text-sm text-blaster-fg hover:bg-gray-50 transition"
                        role="menuitem"
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
