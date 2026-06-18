import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

export function MarketingFooter() {
  return (
    <footer className="py-10 px-4 sm:px-8 border-t border-blaster-border bg-white">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-blaster-muted">
        <Link to="/" className="shrink-0">
          <Logo className="!w-[100px]" />
        </Link>
        <div className="flex flex-wrap justify-center gap-6">
          <Link to="/pricing" className="hover:text-black transition">
            Pricing
          </Link>
          <Link to="/login" className="hover:text-black transition">
            Login
          </Link>
          <Link to="/privacy" className="hover:text-black transition">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-black transition">
            Terms
          </Link>
        </div>
        <p className="text-center sm:text-right">© {new Date().getFullYear()} wiblaster</p>
      </div>
    </footer>
  );
}
