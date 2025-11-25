import React from 'react';
import { cn } from '@/lib/utils';

const PremiumButton = ({ 
  children, 
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props 
}) => {
  const variants = {
    primary: `
      relative overflow-hidden
      bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
      hover:from-blue-600 hover:via-purple-600 hover:to-pink-600
      before:absolute before:inset-0 
      before:bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.2)_0%,transparent_50%)]
      before:opacity-0 hover:before:opacity-100 before:transition-opacity
      after:absolute after:inset-0
      after:bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.15)_0%,transparent_50%)]
      after:opacity-0 hover:after:opacity-100 after:transition-opacity
    `,
    settings: `
      relative overflow-hidden
      bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
      hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600
      before:absolute before:inset-0 
      before:bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.25)_0%,transparent_60%)]
      after:absolute after:inset-0
      after:bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.2)_0%,transparent_60%)]
    `,
    success: `
      relative overflow-hidden
      bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500
      hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600
      before:absolute before:inset-0 
      before:bg-[radial-gradient(circle_at_40%_40%,rgba(255,255,255,0.2)_0%,transparent_50%)]
    `,
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm rounded-lg',
    md: 'px-6 py-3 text-base rounded-xl',
    lg: 'px-8 py-4 text-lg rounded-2xl',
  };

  return (
    <button
      disabled={disabled}
      className={cn(
        'relative text-white font-semibold shadow-lg',
        'transform transition-all duration-300',
        'hover:scale-105 hover:shadow-2xl active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};

export default PremiumButton;
