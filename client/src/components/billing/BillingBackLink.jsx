import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'react-feather';

export function BillingBackLink() {
  return (
    <Link
      to="/app/account/billing"
      className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-blaster-fg hover:opacity-80 mb-3 transition"
    >
      <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
      Back to billing
    </Link>
  );
}

export function BillingPrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function BillingPrimaryLink({ children, className = '', ...props }) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export function BillingOutlineLink({ children, className = '', ...props }) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-blaster-border bg-white text-blaster-fg text-sm font-semibold hover:bg-blaster-bg-app transition ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
