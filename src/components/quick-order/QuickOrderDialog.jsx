import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
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
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="gradient-text">إتمام الطلب</DialogTitle>
            <DialogDescription>إنشاء طلب جديد وإرساله لشركة التوصيل مباشرة.</DialogDescription>
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