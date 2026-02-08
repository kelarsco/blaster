import React from 'react';

/**
 * Custom confirm dialog for admin actions. Use instead of window.confirm.
 * No JS popups – matches admin panel styling.
 */
export function AdminConfirmModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
  if (!open) return null;
  const isDanger = variant === 'danger';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
      <div className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-xl max-w-md w-full p-6">
        <h2 id="admin-confirm-title" className="text-lg font-bold text-blaster-fg mb-2">{title}</h2>
        <p className="text-sm text-blaster-muted mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-border/30 text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blaster-accent hover:opacity-90'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
