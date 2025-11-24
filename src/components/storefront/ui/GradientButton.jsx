import React from 'react';
import { cn } from '@/lib/utils';

const GradientButton = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  shimmer = false,
  className,
  ...props 
}) => {
  const variants = {
    primary: 'btn-gradient-primary',
    success: 'btn-gradient-success',
    warning: 'btn-gradient-warning',
    premium: 'btn-gradient-premium',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl',
  };

  return (
    <button
      className={cn(
        'relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-105 active:scale-95',
        variants[variant],
        sizes[size],
        shimmer && 'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default GradientButton;
