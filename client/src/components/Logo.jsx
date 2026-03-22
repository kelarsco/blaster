import React from 'react';

export function Logo({ className = '', size = 'medium' }) {
  const sizeClasses = {
    small: 'w-5 h-5',
    medium: 'w-6 h-6', 
    large: 'w-8 h-8',
    xlarge: 'w-10 h-10'
  };

  return (
    <img 
      src="/logo.png" 
      alt="wiblaster" 
      className={`${sizeClasses[size] || sizeClasses.medium} ${className}`}
    />
  );
}
