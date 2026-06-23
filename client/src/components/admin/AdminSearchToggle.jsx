import React, { useEffect, useRef } from 'react';
import { Search, X } from 'react-feather';
import { adminIconBtn, adminHoverBg } from './adminStyles.js';

export function AdminSearchToggle({
  value,
  onChange,
  open,
  onOpenChange,
  placeholder = 'Search…',
  ariaLabel = 'Search',
  inputClassName = 'w-full sm:w-64',
}) {
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target) && !value.trim()) {
        onOpenChange(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, value, onOpenChange]);

  const close = () => {
    onChange('');
    onOpenChange(false);
  };

  return (
    <div ref={searchRef} className="flex items-center">
      {open ? (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blaster-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`pl-9 pr-3 py-2 rounded-full border border-blaster-border bg-blaster-bg-card text-blaster-fg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10 ${inputClassName}`}
            />
          </div>
          <button
            type="button"
            onClick={close}
            className={`flex items-center justify-center w-8 h-8 rounded-full text-blaster-muted ${adminHoverBg} hover:text-blaster-fg transition-colors`}
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => onOpenChange(true)} className={adminIconBtn} aria-label={ariaLabel}>
          <Search className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
