import React from 'react';
import { ConfirmDialog } from './ConfirmDialog.jsx';

/** @deprecated Use ConfirmDialog or useConfirm() — kept for admin pages using declarative API. */
export function AdminConfirmModal(props) {
  return <ConfirmDialog {...props} />;
}
