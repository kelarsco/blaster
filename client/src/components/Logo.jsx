import React from 'react';

export function Logo({ className = '' }) {
  return (
    <img 
      src="/logo new.png" 
      alt="wiblaster" 
      className={`w-[120px] md:w-[170px] h-auto ${className}`}
    />
  );
}
