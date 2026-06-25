import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';
import { MARKETING_NAV_LINKS } from './MarketingHeader.jsx';

const PRODUCT_LINKS = [
  { to: '/signup', label: 'Store scanner' },
  { to: '/signup', label: 'Email campaigns' },
  { to: '/pricing', label: 'Pricing' },
];

const COMPANY_LINKS = [
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of service' },
  { to: '/login', label: 'Login' },
];

function FooterLink({ to, href, children }) {
  const className = 'text-sm text-white/70 hover:text-white transition';
  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <p className="font-poppins font-semibold text-sm text-white tracking-wide">{title}</p>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-black text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-[63px] py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-5">
            <Link to="/" className="inline-block shrink-0">
              <Logo className="!w-[120px] brightness-0 invert" />
            </Link>
            <p className="mt-5 font-rubik text-sm text-white/65 leading-relaxed max-w-sm">
              Find ecommerce stores, extract contact emails, and run outreach campaigns from one dashboard.
            </p>
          </div>

          <div className="lg:col-span-2 lg:col-start-7">
            <FooterColumn title="Explore">
              {MARKETING_NAV_LINKS.map((l) => (
                <li key={l.label}>
                  {l.isRoute ? (
                    <FooterLink to={l.href}>{l.label}</FooterLink>
                  ) : (
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  )}
                </li>
              ))}
            </FooterColumn>
          </div>

          <div className="lg:col-span-2">
            <FooterColumn title="Product">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <FooterLink to={l.to}>{l.label}</FooterLink>
                </li>
              ))}
            </FooterColumn>
          </div>

          <div className="lg:col-span-2">
            <FooterColumn title="Company">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  <FooterLink to={l.to}>{l.label}</FooterLink>
                </li>
              ))}
              <li>
                <FooterLink to="/signup">Create account</FooterLink>
              </li>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50 font-rubik">
          <p className="text-center sm:text-left">© {year} wiblaster. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <FooterLink to="/privacy">Privacy</FooterLink>
            <FooterLink to="/terms">Terms</FooterLink>
            <FooterLink to="/pricing">Pricing</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
