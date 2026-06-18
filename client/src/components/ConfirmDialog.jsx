import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Branded confirm dialog — use via useConfirm() or declarative props.
 * Gradient border + 5% brand tint overlay (no window.confirm).
 */
export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl p-[1px] bg-gradient-to-br from-blaster-accent/5 via-blaster-accent/5 to-blaster-orange/5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative rounded-2xl bg-white border border-blaster-border overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blaster-accent/5 via-blaster-orange/5 to-transparent"
            aria-hidden
          />
          <div className="relative p-6">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-blaster-fg">
              {title}
            </h2>
            {message ? (
              <p className="text-sm text-blaster-muted mt-2 leading-relaxed">{message}</p>
            ) : null}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl border border-blaster-border text-sm font-medium text-blaster-muted hover:text-blaster-fg hover:border-blaster-accent/30 transition"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={
                  isDanger
                    ? 'px-4 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition'
                    : 'px-4 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition'
                }
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
