import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Image, Edit2 } from 'react-feather';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';

const PROFILE_KEY = 'wiblaster-profile';
const PROFILE_IMAGE_KEY = 'wiblaster-profile-image';

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { firstName: '', lastName: '' };
}

function loadProfileImage() {
  try {
    return localStorage.getItem(PROFILE_IMAGE_KEY) || null;
  } catch (_) {}
  return null;
}

export function ProfilePage() {
  const { user, authFetch } = useAuth();
  const [profile, setProfile] = useState(loadProfile);
  const [saved, setSaved] = useState(false);
  const [profileImage, setProfileImage] = useState(loadProfileImage);
  const fileInputRef = useRef(null);

  const isGoogleUser = user?.auth_provider === 'google';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setProfileImage(dataUrl);
      try {
        localStorage.setItem(PROFILE_IMAGE_KEY, dataUrl);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('profileImageUpdated'));
      } catch (_) {}
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const save = () => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    if (!authFetch) return;
    setPasswordLoading(true);
    try {
      const res = await authFetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError(data.error || 'Failed to change password');
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const email = user?.email || '';
  const nameParts = (user?.name || '').split(' ');
  const defaultFirst = nameParts[0] || profile.firstName;
  const defaultLast = nameParts.slice(1).join(' ') || profile.lastName;

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-blaster-bg-app">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Account</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
        {/* Left column */}
        <div className="space-y-8">
          {/* Profile photo */}
          <section>
            <h2 className="font-semibold text-blaster-fg mb-3">Profile photo</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-24 h-24 rounded-full bg-blaster-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
              aria-label="Change profile photo"
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Image className="w-12 h-12 text-blaster-muted" strokeWidth={1.5} />
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Edit2 className="w-6 h-6 text-white" strokeWidth={2} />
              </span>
            </button>
          </section>

          {/* Basic information */}
          <section>
            <h2 className="card-title-mobile mb-3 md:mb-4">Basic information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blaster-fg mb-1">Username</label>
                <input
                  type="text"
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-gray-100 text-blaster-muted cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blaster-fg mb-1">First name</label>
                <input
                  type="text"
                  value={profile.firstName || defaultFirst}
                  onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="First name"
                  className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blaster-fg mb-1">Last name</label>
                <input
                  type="text"
                  value={profile.lastName || defaultLast}
                  onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Last name"
                  className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blaster-fg mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-gray-100 text-blaster-muted cursor-not-allowed"
                />
              </div>
              <button
                type="button"
                onClick={save}
                className="btn-blaster-accent text-sm"
              >
                {saved ? 'Saved' : 'Update'}
              </button>
            </div>
          </section>
        </div>

        {/* Right column - Change password */}
        <section>
          <h2 className="card-title-mobile mb-3 md:mb-4">Change password</h2>
          {isGoogleUser ? (
            <>
              <div className="rounded-lg bg-gray-100 border border-blaster-border p-4 flex gap-3 mb-6">
                <div className="w-6 h-6 rounded-full bg-blaster-muted/30 flex items-center justify-center shrink-0 text-blaster-muted text-xs font-semibold">
                  i
                </div>
                <p className="text-sm text-blaster-muted">
                  You&apos;re using Google credentials to sign in to wiblaster. You&apos;ll need to make any changes to your current username and password in your Google account.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blaster-fg mb-1">Verify current password</label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder=""
                      disabled
                      className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-gray-100 text-blaster-muted cursor-not-allowed"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blaster-accent hover:underline"
                      disabled
                    >
                      Show
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blaster-fg mb-1">New password</label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder=""
                      disabled
                      className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-gray-100 text-blaster-muted cursor-not-allowed"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blaster-accent hover:underline"
                      disabled
                    >
                      Show
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blaster-fg mb-1">Confirm new password</label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder=""
                      disabled
                      className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-gray-100 text-blaster-muted cursor-not-allowed"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blaster-accent hover:underline"
                      disabled
                    >
                      Show
                    </button>
                  </div>
                </div>
                <button type="button" disabled className="btn-blaster-accent text-sm opacity-60 cursor-not-allowed">
                  Update
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 text-sm">
                  Password updated successfully.
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-blaster-fg">Verify current password</label>
                  <Link to="/forgot-password" className="text-xs text-blaster-accent hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blaster-accent hover:underline"
                  >
                    {showCurrent ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blaster-fg mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blaster-accent hover:underline"
                  >
                    {showNew ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-blaster-muted">
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>One lowercase character</li>
                    <li>One uppercase character</li>
                    <li>One number</li>
                  </ul>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>One special character</li>
                    <li>8 characters minimum</li>
                    <li>Must not contain username</li>
                  </ul>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blaster-fg mb-1">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blaster-accent hover:underline"
                  >
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                className="btn-blaster-accent text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {passwordLoading ? 'Updating…' : 'Update'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
