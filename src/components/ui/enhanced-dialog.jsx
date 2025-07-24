import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const EnhancedDialog = ({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  icon, 
  children, 
  className = "", 
  ...props 
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`${className} animate-scale-in`}
        onPointerDownOutside={() => onOpenChange(false)}
        onInteractOutside={() => onOpenChange(false)}
        {...props}
      >
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-3 pr-10">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                {React.cloneElement(icon, { className: "w-5 h-5 text-primary-foreground" })}
              </div>
            )}
            <span>{title}</span>
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-0 right-0 w-8 h-8 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 flex items-center justify-center group shadow-sm hover:shadow-md"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};

export { EnhancedDialog };