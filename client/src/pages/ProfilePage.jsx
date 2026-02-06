import React, { useState, useRef } from 'react';
import { Image } from 'react-feather';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const [profile, setProfile] = useState(loadProfile);
  const [saved, setSaved] = useState(false);
  const [profileImage, setProfileImage] = useState(loadProfileImage);
  const fileInputRef = useRef(null);

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
  };

  const save = () => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
  };

  const email = user?.email || '';
  const nameParts = (user?.name || '').split(' ');
  const defaultFirst = nameParts[0] || profile.firstName;
  const defaultLast = nameParts.slice(1).join(' ') || profile.lastName;

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-blaster-bg-app">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Account</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          This is where you manage profile details specific to you. To manage what communication you receive from wiblaster, go to your{' '}
          <a href="#" className="text-blaster-accent hover:underline">communication preferences page</a>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
        {/* Left column */}
        <div className="space-y-8">
          {/* Profile photo */}
          <section>
            <h2 className="font-semibold text-blaster-fg mb-3">Profile photo</h2>
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-24 h-24 rounded-full bg-blaster-border overflow-hidden flex items-center justify-center shrink-0">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-12 h-12 text-blaster-muted" strokeWidth={1.5} />
                )}
              </div>
              <div>
                <p className="text-sm text-blaster-muted">
                  Upload your photo ... Photo should be at least 300px × 300px
                </p>
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
                  className="mt-3 btn-blaster-accent text-sm"
                >
                  Upload Photo
                </button>
              </div>
            </div>
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
                >
                  Show
                </button>
              </div>
              <a href="#" className="text-sm text-blaster-accent hover:underline">Generate strong password</a>
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
                  type="password"
                  placeholder=""
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-gray-100 text-blaster-muted cursor-not-allowed"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blaster-accent hover:underline"
                >
                  Show
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled
              className="btn-blaster-accent text-sm opacity-60 cursor-not-allowed"
            >
              Update
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
