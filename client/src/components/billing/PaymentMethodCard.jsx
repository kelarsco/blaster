import React from 'react';
import { CreditCard } from 'react-feather';

const BRAND_STYLES = {
  Visa: 'from-[#1a1f71] to-[#2d3a8c]',
  Mastercard: 'from-[#1a1a1a] to-[#3d3d3d]',
  Verve: 'from-[#6b21a8] to-[#9333ea]',
  Amex: 'from-[#006fcf] to-[#0095da]',
  Card: 'from-[#1f2937] to-[#374151]',
};

export function formatCardBrand(brand) {
  if (!brand || brand === 'card') return 'Card';
  const s = String(brand).toLowerCase();
  if (s.includes('visa')) return 'Visa';
  if (s.includes('master')) return 'Mastercard';
  if (s.includes('verve')) return 'Verve';
  if (s.includes('amex') || s.includes('american')) return 'Amex';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function PaymentMethodCard({ card, compact = false }) {
  const brand = formatCardBrand(card.brand);
  const gradient = BRAND_STYLES[brand] || BRAND_STYLES.Card;
  const expLabel =
    card.expMonth && card.expYear
      ? `${card.expMonth}/${String(card.expYear).slice(-2)}`
      : '—';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-blaster-border bg-gradient-to-br ${gradient} text-white shadow-md ${
        compact ? 'p-4 min-h-[120px]' : 'p-5 min-h-[148px]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-medium">Payment method</p>
          {card.isDefault && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold uppercase tracking-wide">
              Default
            </span>
          )}
        </div>
        <div className="w-10 h-7 rounded-md bg-white/15 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-white/90" strokeWidth={1.75} aria-hidden />
        </div>
      </div>

      <div className={compact ? 'mt-6' : 'mt-8'}>
        <p className="font-mono text-lg sm:text-xl tracking-[0.2em] text-white/95">
          •••• •••• •••• {card.last4}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2 text-xs text-white/75">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Card</p>
            <p className="font-medium text-white/90">{brand}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Expires</p>
            <p className="font-medium text-white/90">{expLabel}</p>
          </div>
        </div>
        {card.bank && (
          <p className="mt-2 text-[11px] text-white/60 truncate">{card.bank}</p>
        )}
      </div>
    </div>
  );
}
