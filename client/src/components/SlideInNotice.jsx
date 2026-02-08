import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'react-feather';

/**
 * Friendly slide-in notice (from the right). Use instead of alert() for errors or info.
 * @param {boolean} visible - Whether the notice is shown
 * @param {string} message - Main message text
 * @param {string} type - 'error' | 'success' | 'info'
 * @param {function} onClose - Called when user dismisses or auto-dismiss runs
 * @param {number} autoDismissMs - Auto-close after this many ms (0 = no auto)
 * @param {string} title - Optional short title (e.g. "Something went wrong")
 */
export function SlideInNotice({ visible, message, type = 'error', onClose, autoDismissMs = 6000, title = null }) {
  useEffect(() => {
    if (!visible || !autoDismissMs || !onClose) return;
    const t = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, autoDismissMs, onClose]);

  if (!visible) return null;

  const isError = type === 'error';
  const isSuccess = type === 'success';
  const icon = isSuccess ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" strokeWidth={2} /> : isError ? <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" strokeWidth={2} /> : <Info className="w-5 h-5 shrink-0 text-blaster-accent" strokeWidth={2} />;
  const borderClass = isError ? 'border-amber-500/40' : isSuccess ? 'border-emerald-500/40' : 'border-blaster-accent/40';
  const bgClass = isError ? 'bg-amber-500/5' : isSuccess ? 'bg-emerald-500/5' : 'bg-blaster-accent/5';

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`pointer-events-auto absolute top-4 right-4 w-full max-w-sm rounded-xl border shadow-lg ${borderClass} ${bgClass} p-4 animate-slide-in-right`}
        role="alert"
      >
        <div className="flex gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            {title && <p className="font-semibold text-blaster-fg text-sm mb-0.5">{title}</p>}
            <p className="text-sm text-blaster-fg">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-bg-app/80 transition-colors focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
