import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const EmployeeDialog = ({ open, onOpenChange, children, title }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "w-[90vw] max-w-4xl max-h-[80vh]",
          "bg-background border border-border rounded-lg shadow-xl",
          "p-0 gap-0 overflow-hidden"
        )}
      >
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold">
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeDialog;