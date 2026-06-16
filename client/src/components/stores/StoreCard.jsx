import React, { useState } from 'react';
import { Copy, ExternalLink, Mail, Phone } from 'react-feather';
import { storeDisplayName, storeFaviconUrl } from '../../utils/storeDisplay.js';

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

export function StoreCard({ store, viewMode }) {
  const [logoError, setLogoError] = useState(false);
  const displayName = storeDisplayName(store.storeUrl);
  const favicon = storeFaviconUrl(store.storeUrl);
  const emailCount = store.emails?.length || 0;
  const primaryEmail = store.emails?.[0]?.email;

  const visitStore = () => {
    if (store.storeUrl) window.open(store.storeUrl, '_blank', 'noopener,noreferrer');
  };

  if (viewMode === 'list') {
    return (
      <article className="stores-glass stores-list-row">
        <div className="stores-logo">
          {favicon && !logoError ? (
            <img src={favicon} alt="" onError={() => setLogoError(true)} />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <a href={store.storeUrl} target="_blank" rel="noopener noreferrer" className="stores-list-url">
          {store.storeUrl}
        </a>
        <div className="stores-list-badges">
          {emailCount > 0 ? (
            <span className="stores-badge">{emailCount} email{emailCount !== 1 ? 's' : ''}</span>
          ) : (
            <span className="stores-badge stores-badge-muted">No email</span>
          )}
          <button type="button" className="stores-icon-btn" onClick={() => copyToClipboard(store.storeUrl)} aria-label="Copy">
            <Copy className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button type="button" className="stores-icon-btn" onClick={visitStore} aria-label="Open">
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="stores-glass stores-grid-card">
      <div className="flex items-start gap-3">
        <div className="stores-logo">
          {favicon && !logoError ? (
            <img src={favicon} alt="" onError={() => setLogoError(true)} />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blaster-fg truncate">{displayName}</h3>
          <a href={store.storeUrl} target="_blank" rel="noopener noreferrer" className="stores-list-url block mt-0.5">
            {store.storeUrl}
          </a>
          {primaryEmail ? (
            <p className="text-xs text-blaster-muted mt-1 truncate">{primaryEmail}</p>
          ) : null}
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
        <span className="stores-meta-item">
          <Mail className="w-3.5 h-3.5" strokeWidth={1.75} />
          {emailCount > 0 ? `${emailCount} email${emailCount !== 1 ? 's' : ''}` : 'No email'}
        </span>
        {store.phone ? (
          <span className="stores-meta-item">
            <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
            {store.phone}
          </span>
        ) : null}
      </div>
    </article>
  );
}
