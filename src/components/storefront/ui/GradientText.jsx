import React from 'react';
import { cn } from '@/lib/utils';

const GradientText = ({ 
  children, 
  variant = 'holographic',
  animate = false,
  className,
  as: Component = 'span',
  ...props 
}) => {
  const variants = {
    holographic: 'gradient-text-holographic',
    primary: 'gradient-text',
    gold: 'gradient-text-gold',
    emerald: 'gradient-text-emerald',
    fire: 'gradient-text-fire',
  };

  return (
    <Component
      className={cn(
        'font-bold',
        variants[variant],
        animate && 'animate-gradient',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

export default GradientText;
