import React from 'react';
import { X } from 'react-feather';

/**
 * In-page admin message (success or error). Use instead of alert().
 * Custom styled banner with dismiss button.
 */
export function AdminMessage({ type = 'error', message, onDismiss }) {
  if (!message) return null;
  const isSuccess = type === 'success';
  return (
    <div
      className={`mb-4 p-4 rounded-xl border flex items-start gap-3 ${
        isSuccess
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
      }`}
      role="status"
    >
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-black/10 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
