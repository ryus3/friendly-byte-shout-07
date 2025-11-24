import React from 'react';
import { cn } from '@/lib/utils';

const AnimatedBadge = ({ 
  children, 
  variant = 'primary',
  pulse = false,
  glow = false,
  className,
  ...props 
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-500',
    success: 'bg-gradient-to-r from-emerald-400 to-teal-500',
    warning: 'bg-gradient-to-r from-amber-400 to-orange-500',
    danger: 'bg-gradient-to-r from-red-500 to-pink-500',
    premium: 'bg-gradient-to-r from-yellow-400 to-orange-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white',
        variants[variant],
        pulse && 'animate-pulse',
        glow && 'shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default AnimatedBadge;
