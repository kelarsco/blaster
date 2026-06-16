import React, { useState } from 'react';

export function CampaignNameModal({ onClose, onConfirm, saving }) {
  const [name, setName] = useState('');

  const trimmed = name.trim().slice(0, 5);
  const canConfirm = trimmed.length >= 1 && trimmed.length <= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
      <div
        className="w-full max-w-sm rounded-2xl border border-blaster-border bg-white shadow-xl p-6"
        role="dialog"
        aria-labelledby="campaign-name-title"
      >
        <div className="flex justify-center mb-4">
          <img src="/wi-icon.png" alt="" className="h-10 w-10 object-contain" />
        </div>
        <h3 id="campaign-name-title" className="text-base font-semibold text-blaster-fg text-center">
          Name your campaign
        </h3>
        <p className="text-xs text-blaster-muted text-center mt-1 mb-4">Up to 5 characters</p>
        <input
          type="text"
          maxLength={5}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 5))}
          placeholder="e.g. Q1"
          autoFocus
          className="w-full px-4 py-2.5 rounded-xl border border-blaster-border bg-gray-50/80 text-blaster-fg text-center text-lg font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-blaster-accent/30"
        />
        <p className="text-[10px] text-blaster-muted text-center mt-1">{trimmed.length}/5</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-blaster-border text-sm text-blaster-muted hover:text-blaster-fg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || saving}
            onClick={() => onConfirm(trimmed)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
