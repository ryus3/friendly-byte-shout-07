import { cn } from '@/lib/utils.js';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';

// Enhanced Toast Provider with all-direction swipe support
const EnhancedToastProvider = React.forwardRef(({ children, ...props }, ref) => (
  <ToastPrimitives.Provider
    ref={ref}
    swipeDirection="all"
    swipeThreshold={25}
    {...props}
  >
    {children}
  </ToastPrimitives.Provider>
));
EnhancedToastProvider.displayName = "EnhancedToastProvider";

// Enhanced Toast with improved swipe detection
const EnhancedToast = React.forwardRef(({ className, variant, onDismiss, ...props }, ref) => {
  const toastRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  const SWIPE_THRESHOLD = 50;

  // Handle touch start
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setStartPosition({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startPosition.x;
    const deltaY = touch.clientY - startPosition.y;
    
    setDragPosition({ x: deltaX, y: deltaY });
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const distance = Math.sqrt(dragPosition.x ** 2 + dragPosition.y ** 2);
    
    if (distance > SWIPE_THRESHOLD) {
      // Dismiss the toast
      onDismiss?.();
    }
    
    // Reset
    setIsDragging(false);
    setDragPosition({ x: 0, y: 0 });
  };

  // Handle mouse events for desktop
  const handleMouseDown = (e) => {
    setStartPosition({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startPosition.x;
    const deltaY = e.clientY - startPosition.y;
    
    setDragPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    const distance = Math.sqrt(dragPosition.x ** 2 + dragPosition.y ** 2);
    
    if (distance > SWIPE_THRESHOLD) {
      onDismiss?.();
    }
    
    setIsDragging(false);
    setDragPosition({ x: 0, y: 0 });
  };

  // Add mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, startPosition]);

  const transformStyle = isDragging ? {
    transform: `translate(${dragPosition.x}px, ${dragPosition.y}px) scale(0.95)`,
    opacity: 0.7,
    transition: 'none'
  } : {};

  return (
    <ToastPrimitives.Root
      ref={toastRef}
      className={cn(
        'group relative pointer-events-auto flex w-full items-center space-x-4 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg transition-all duration-200 ease-out',
        'bg-background/80 backdrop-blur-lg border-border text-foreground',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full',
        'data-[state=closed]:slide-out-to-top-full',
        isDragging && 'cursor-grabbing select-none',
        className
      )}
      style={transformStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      {...props}
    />
  );
});
EnhancedToast.displayName = ToastPrimitives.Root.displayName;

export {
  EnhancedToastProvider,
  EnhancedToast,
};