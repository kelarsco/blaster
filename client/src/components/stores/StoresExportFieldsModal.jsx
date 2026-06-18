import React, { useState } from 'react';

export const STORES_EXPORT_FIELD_OPTIONS = [
  { key: 'storeUrl', label: 'Store URL', locked: true },
  { key: 'platform', label: 'Platform' },
  { key: 'countryCode', label: 'Country' },
  { key: 'currency', label: 'Currency' },
  { key: 'productCount', label: 'Products' },
  { key: 'tags', label: 'Tags' },
  { key: 'createdAt', label: 'Created' },
];

const DEFAULT_FIELDS = {
  storeUrl: true,
  platform: true,
  countryCode: true,
  currency: true,
  productCount: true,
  tags: true,
  createdAt: true,
};

export function StoresExportFieldsModal({ onClose, onConfirm }) {
  const [fields, setFields] = useState({ ...DEFAULT_FIELDS });

  const toggle = (key) => {
    if (key === 'storeUrl') return;
    setFields((f) => ({ ...f, [key]: !f[key] }));
  };

  const hasSelection = STORES_EXPORT_FIELD_OPTIONS.some((opt) => fields[opt.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-blaster-border bg-white shadow-xl p-5">
        <h3 className="text-sm font-semibold text-blaster-fg mb-1">Export stores</h3>
        <p className="text-xs text-blaster-muted mb-4">
          Choose which fields to include. Store URL is always first.
        </p>
        <div className="space-y-2">
          {STORES_EXPORT_FIELD_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm text-blaster-fg ${
                fields[opt.key]
                  ? 'border-blaster-accent/30 bg-gradient-to-r from-blaster-accent/10 to-blaster-orange/15'
                  : 'border-blaster-border bg-gray-50/60'
              } ${opt.locked ? 'opacity-80' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={fields[opt.key]}
                disabled={opt.locked}
                onChange={() => toggle(opt.key)}
                className="blaster-checkbox"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-blaster-muted hover:text-blaster-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => onConfirm(fields)}
            className="px-4 py-2 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 disabled:opacity-40"
          >
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
