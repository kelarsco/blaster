import React from 'react';
import { Link } from 'react-router-dom';
import { adminPrimaryBtn, adminGhostBtn } from './adminStyles.js';

export function AdminButton({ variant = 'primary', to, className = '', children, ...props }) {
  const base = variant === 'ghost' ? adminGhostBtn : adminPrimaryBtn;
  const classes = `${base} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
