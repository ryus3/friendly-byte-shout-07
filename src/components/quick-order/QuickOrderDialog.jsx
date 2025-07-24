import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2, Zap } from 'lucide-react';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { useInventory } from '@/contexts/InventoryContext';

const QuickOrderDialog = ({ open, onOpenChange, onOrderCreated }) => {
  const formRef = useRef(null);
  const { cart } = useInventory();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTriggerSubmit = () => {
    if (formRef.current) {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      formRef.current.dispatchEvent(submitEvent);
    }
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setIsSubmitting(false); // Reset submitting state on close
    }
    onOpenChange(isOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="max-w-4xl h-[90vh] flex flex-col animate-scale-in"
          onPointerDownOutside={() => handleOpenChange(false)}
          onInteractOutside={() => handleOpenChange(false)}
        >
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-3 pr-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="gradient-text">إتمام الطلب</span>
            </DialogTitle>
            <DialogDescription>إنشاء طلب جديد وإرساله لشركة التوصيل مباشرة.</DialogDescription>
            <button
              onClick={() => handleOpenChange(false)}
              className="absolute top-0 right-0 w-8 h-8 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 flex items-center justify-center group shadow-sm hover:shadow-md"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto py-4 pr-2 -mr-2">
            <QuickOrderContent 
              isDialog={true}
              formRef={formRef}
              onOrderCreated={() => {
                if (onOrderCreated) onOrderCreated();
                handleOpenChange(false); // Close dialog on success
              }}
              setIsSubmitting={setIsSubmitting}
              isSubmittingState={isSubmitting}
            />
          </div>

          <DialogFooter className="mt-auto pt-4 border-t flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}><X className="w-4 h-4 ml-2" />إلغاء</Button>
            <Button type="button" onClick={handleTriggerSubmit} disabled={isSubmitting || cart.length === 0}>
              {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تأكيد الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickOrderDialog;