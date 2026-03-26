import React from 'react';

export function Logo({ className = '' }) {
  return (
    <img 
      src="/logo.png" 
      alt="wiblaster" 
      className={`w-[130px] h-auto ${className}`}
    />
  );
}
