import React from 'react';

export function Logo({ className = '' }) {
  // Add cache-busting timestamp
  const cacheBuster = Date.now();
  
  return (
    <img 
      src={`/logo.png?v=${cacheBuster}`} 
      alt="wiblaster" 
      className={`w-[40%] h-[40%] ${className}`}
    />
  );
}
