import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

const ConfirmDialogContext = createContext(null);

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {'danger'|'default'} [options.variant]
 * @returns {Promise<boolean>}
 */
export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        title: options.title ?? 'Are you sure?',
        message: options.message ?? '',
        confirmLabel: options.confirmLabel ?? (options.variant === 'danger' ? 'Delete' : 'Confirm'),
        cancelLabel: options.cancelLabel ?? 'Cancel',
        variant: options.variant ?? 'danger',
      });
    });
  }, []);

  const close = (result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog(null);
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {dialog ? (
        <ConfirmDialog
          open
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          variant={dialog.variant}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmDialogProvider');
  }
  return ctx.confirm;
}
