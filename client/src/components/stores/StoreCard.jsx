import React from 'react';
import { Copy, ExternalLink } from 'react-feather';
import { storeDisplayName } from '../../utils/storeDisplay.js';
import { StoreSiteLogo } from './StoreSiteLogo.jsx';

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

export function StoreCard({ store, viewMode }) {
  const displayName = storeDisplayName(store.storeUrl);
  const countryCode = store.countryCode && store.countryCode !== 'XX' ? store.countryCode : '—';
  const currency = store.currency || 'USD';
  const productLabel = `${store.productCount ?? 0}P`;
  const listProductLabel = `${store.productCount ?? 0} PRD`;

  const visitStore = () => {
    if (store.storeUrl) window.open(store.storeUrl, '_blank', 'noopener,noreferrer');
  };

  if (viewMode === 'list') {
    return (
      <article className="stores-glass stores-list-row">
        <div className="stores-logo stores-logo-sm">
          <StoreSiteLogo storeUrl={store.storeUrl} />
        </div>
        <a
          href={store.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="stores-list-url stores-list-url-flex"
        >
          {store.storeUrl}
        </a>
        <div className="stores-list-right">
          <span className="stores-stat-pill stores-stat-pill-muted">{listProductLabel}</span>
          <span className="stores-stat-pill stores-stat-pill-muted">{currency}</span>
          <span className="stores-stat-pill">{countryCode}</span>
        </div>
      </article>
    );
  }

  return (
    <article className="stores-glass stores-grid-card">
      <div className="flex items-start gap-3">
        <div className="stores-logo stores-logo-sm">
          <StoreSiteLogo storeUrl={store.storeUrl} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blaster-fg truncate">{displayName}</h3>
          <a
            href={store.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="stores-list-url block mt-0.5 truncate"
          >
            {store.storeUrl}
          </a>
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" className="stores-icon-btn" onClick={() => copyToClipboard(store.storeUrl)} aria-label="Copy">
            <Copy className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button type="button" className="stores-icon-btn" onClick={visitStore} aria-label="Open">
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="stores-meta-row">
        <span className="stores-stat-pill">{countryCode}</span>
        <span className="stores-stat-pill stores-stat-pill-muted">{productLabel}</span>
        <span className="stores-stat-pill stores-stat-pill-muted">{currency}</span>
      </div>
    </article>
  );
}
