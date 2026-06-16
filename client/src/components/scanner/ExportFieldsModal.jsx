import React, { useState } from 'react';

const FIELD_OPTIONS = [
  { key: 'storeUrl', label: 'Store links', locked: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'whatsapp', label: 'WhatsApp link' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
];

export function ExportFieldsModal({ onClose, onConfirm }) {
  const [fields, setFields] = useState({
    storeUrl: true,
    email: true,
    phone: false,
    whatsapp: false,
    instagram: false,
    tiktok: false,
  });

  const toggle = (key) => {
    if (key === 'storeUrl') return;
    setFields((f) => ({ ...f, [key]: !f[key] }));
  };

  const hasDataField = fields.email || fields.phone || fields.whatsapp || fields.instagram || fields.tiktok;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-blaster-border bg-white shadow-xl p-5">
        <h3 className="text-sm font-semibold text-blaster-fg mb-1">Export scan results</h3>
        <p className="text-xs text-blaster-muted mb-4">
          Only stores with extracted data are included. Store URL is always first.
        </p>
        <div className="space-y-2">
          {FIELD_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm ${
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
                className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent"
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
            disabled={!hasDataField}
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
