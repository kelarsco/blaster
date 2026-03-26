import React from 'react';

export function Logo({ className = '' }) {
  return (
    <img 
      src="/logo.png" 
      alt="wiblaster" 
      className={`w-auto h-8 sm:h-10 md:h-12 max-w-[120px] sm:max-w-[150px] md:max-w-[180px] ${className}`}
    />
  );
}
