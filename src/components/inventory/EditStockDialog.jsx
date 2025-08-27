import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/components/ui/use-toast';
import Loader from '@/components/ui/loader';
import { Card, CardContent } from '@/components/ui/card';

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
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            تعديل المخزون
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="text-center">
                {variant.image || product.image || product.images?.[0] ? (
                  <img 
                    src={variant.image || product.image || product.images?.[0]}
                    alt={product.name}
                    className="w-20 h-20 rounded-lg object-cover mx-auto border border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <h3 className="font-bold text-lg mt-2 text-foreground">{product.name}</h3>
                <p className="text-muted-foreground font-medium">{variant.color} • {variant.size}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">الكمية الحالية</Label>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <span className="text-2xl font-bold text-primary">{variant.quantity}</span>
                <span className="text-muted-foreground ml-1">قطعة</span>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">الكمية الجديدة</Label>
              <Input
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                className="text-center text-lg font-semibold"
                min="0"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button onClick={handleUpdate} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader size="sm" />
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    تحديث المخزون
                  </>
                )}
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