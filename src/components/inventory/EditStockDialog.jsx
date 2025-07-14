import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/components/ui/use-toast';
import Loader from '@/components/ui/loader';

const EditStockDialog = ({ item, open, onOpenChange }) => {
  const { updateVariantStock } = useInventory();
  const [newQuantity, setNewQuantity] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setNewQuantity(item.variant.quantity);
    }
  }, [item]);

  if (!item) return null;

  const { product, variant } = item;
  
  const handleUpdate = async () => {
    setIsSubmitting(true);
    const result = await updateVariantStock(product.id, { color: variant.color, size: variant.size }, newQuantity);
    if (result.success) {
        toast({ title: "نجاح", description: "تم تحديث المخزون بنجاح." });
        onOpenChange(false);
    } else {
        toast({ title: "خطأ", description: result.error, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="gradient-text">تعديل المخزون</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-center">
            {variant.image || product.image || product.images?.[0] ? (
              <img 
                src={variant.image || product.image || product.images?.[0]}
                alt={product.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <p className="text-muted-foreground">{variant.color} - {variant.size}</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">الكمية الحالية</Label>
              <div className="p-3 bg-secondary rounded-lg">
                <span className="text-xl font-bold text-primary">{variant.quantity} قطعة</span>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">الكمية الجديدة</Label>
              <Input
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                className="text-center"
                min="0"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleUpdate} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? <Loader size="sm" /> : 'تحديث المخزون'}
              </Button>
              <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1" disabled={isSubmitting}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditStockDialog;