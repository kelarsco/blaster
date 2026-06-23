import React from 'react';

export function Logo({ className = '', variant = 'full' }) {
  if (variant === 'icon') {
    return (
      <img
        src="/logo.png"
        alt="wiblaster"
        className={`h-8 w-8 object-contain ${className}`}
      />
    );
  }

  return (
    <img
      src="/logo new.png"
      alt="wiblaster"
      className={`w-[154px] h-auto ${className}`}
    />
  );
}
