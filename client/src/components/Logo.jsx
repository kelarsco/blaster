import React from 'react';

export function Logo({ className = '' }) {
  return (
    <img 
      src="/favicon.png" 
      alt="wiblaster" 
      className={`w-[50px] h-auto ${className}`}
    />
  );
}
