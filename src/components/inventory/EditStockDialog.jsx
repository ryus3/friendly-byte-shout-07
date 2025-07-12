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
            <img 
              src={variant.image || product.image || "/api/placeholder/150/150"}
              alt={product.name}
              className="w-20 h-20 object-cover rounded-lg mx-auto mb-4"
             />
            <h3 className="text-lg font-bold text-foreground">{product.name}</h3>
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