import React from 'react';

export function Logo({ className = '' }) {
  return (
    <img 
      src="/logo.png" 
      alt="wiblaster" 
      className={`w-[40%] h-[40%] ${className}`}
    />
  );
}
