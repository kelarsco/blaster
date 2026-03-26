import React from 'react';

export function Logo({ className = '' }) {
  return (
    <img 
      src="/logo.png" 
      alt="wiblaster" 
      className={`w-[100px] h-auto ${className}`}
    />
  );
}
