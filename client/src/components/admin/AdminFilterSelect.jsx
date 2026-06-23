import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'react-feather';
import { adminPillBtn } from './adminStyles.js';

export function AdminFilterSelect({ value, onChange, options, ariaLabel, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={ariaLabel}
        className={adminPillBtn}
      >
        <span className="truncate max-w-[180px]">{selected?.label}</span>
        <ChevronDown className={`w-4 h-4 text-blaster-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1.5 min-w-[200px] max-h-64 overflow-y-auto py-1.5 rounded-xl border border-blaster-border bg-blaster-bg-card shadow-xl z-30 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value ?? '__all__'}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex items-center justify-between gap-3 w-full px-3.5 py-2 text-left text-sm transition-colors ${
                value === o.value
                  ? 'text-blaster-fg bg-blaster-sidebar-hover font-medium'
                  : 'text-blaster-muted hover:bg-blaster-sidebar-hover hover:text-blaster-fg'
              }`}
            >
              <span className="truncate">{o.label}</span>
              {value === o.value && <Check className="w-4 h-4 text-blaster-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
