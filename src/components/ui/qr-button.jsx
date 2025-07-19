import React from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

const QRIcon = ({ className, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <rect x="3" y="3" width="5" height="5" fill="currentColor"/>
    <rect x="3" y="16" width="5" height="5" fill="currentColor"/>
    <rect x="16" y="3" width="5" height="5" fill="currentColor"/>
    <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
    <rect x="5" y="5" width="1" height="1" fill="white"/>
    <rect x="5" y="18" width="1" height="1" fill="white"/>
    <rect x="18" y="5" width="1" height="1" fill="white"/>
  </svg>
);

const QRButton = ({ 
  children, 
  onClick, 
  variant = "outline", 
  size = "default",
  className,
  disabled = false,
  ...props 
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 font-medium transition-all duration-200",
        "hover:shadow-lg hover:scale-105 active:scale-95",
        variant === "outline" && "border-primary/20 hover:border-primary/40",
        className
      )}
      {...props}
    >
      <QRIcon size={size === "sm" ? 16 : size === "lg" ? 24 : 20} />
      {children}
    </Button>
  );
};

export { QRButton, QRIcon };