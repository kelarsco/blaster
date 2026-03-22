import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878a4.5 4.5 0 106.262 6.262M4.5 4.5a9.97 9.97 0 011.563-3.029m11.858 11.858A9.97 9.97 0 0121 12c0 4.478-2.943 8.268-7 9.543" />
  </svg>
);

/** Password input with show/hide toggle. Pass through standard input props. Optional visible + onVisibilityChange to control from parent (e.g. to sync two fields). */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
  className = authInputClass,
  visible: controlledVisible,
  onVisibilityChange,
}) {
  const [internalVisible, setInternalVisible] = useState(false);
  const isControlled = controlledVisible !== undefined && typeof onVisibilityChange === 'function';
  const visible = isControlled ? controlledVisible : internalVisible;
  const setVisible = isControlled ? onVisibilityChange : setInternalVisible;
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={className + ' pr-10'}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-blaster-muted hover:text-blaster-fg p-1 rounded focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

/** Plain password/text input that follows a shared visibility state (no eye). Use with PasswordInput visible + onVisibilityChange for paired fields. */
export function PasswordInputFollow({ id, value, onChange, placeholder, autoComplete, required, minLength, className = authInputClass, visible }) {
  return (
    <input
      id={id}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      minLength={minLength}
      className={className}
    />
  );
}

/**
 * Shared layout for login/signup. Form centered in the middle of the viewport.
 */
export function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white px-4 sm:px-6 py-10">
      <div className="w-full max-w-[420px]">
        {children}
      </div>
    </div>
  );
}

export const authInputClass =
  'w-full px-4 py-3 rounded-xl border border-blaster-input-border text-blaster-fg placeholder-blaster-muted focus:outline-none transition text-sm';

export const authPrimaryButtonClass =
  'w-full py-3 rounded-xl bg-black hover:bg-gray-800 text-white font-semibold text-sm transition shadow-sm disabled:opacity-50 active:scale-[0.99]';

export const authSecondaryButtonClass =
  'w-full py-2.5 rounded-xl border border-blaster-border bg-white hover:bg-blaster-bg-app text-blaster-fg font-medium text-sm transition disabled:opacity-50';

export function AuthLogoLink() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 text-blaster-fg font-semibold text-base mb-8"
    >
      <Logo />
    </Link>
  );
}
