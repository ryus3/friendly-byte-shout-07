import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Package, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const ReturnReceiptDialog = ({ open, onClose, order, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessReturn = async () => {
    try {
      setIsProcessing(true);

      // تحديث المخزون لكل منتج في الطلب
      for (const item of order.items || []) {
        // إضافة الكمية المرجعة إلى المخزون
        const { error: inventoryError } = await supabase
          .rpc('update_reserved_stock', {
            p_product_id: item.product_id,
            p_quantity_change: -item.quantity, // إضافة للمخزون
            p_sku: item.variant_id
          });

        if (inventoryError) {
          console.error('خطأ في تحديث المخزون:', inventoryError);
        }

        // تحديث الكمية الفعلية في المخزون
        await supabase
          .from('inventory')
          .update({
            quantity: supabase.sql`quantity + ${item.quantity}`,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', item.product_id)
          .eq('variant_id', item.variant_id || null);
      }

      // تحديث حالة الطلب إلى "مستلم الراجع"
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'return_received',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) {
        throw new Error(`خطأ في تحديث حالة الطلب: ${orderError.message}`);
      }

      toast({
        title: "تم استلام الراجع بنجاح",
        description: "تم إرجاع جميع المنتجات إلى المخزون",
        variant: "success"
      });

      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      console.error('خطأ في معالجة الراجع:', error);
      toast({
        title: "خطأ في استلام الراجع",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-500" />
            استلام الطلب المرجع - {order?.tracking_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">هل تريد استلام هذا الطلب المرجع؟</h3>
                <p className="text-muted-foreground">
                  سيتم إرجاع جميع منتجات هذا الطلب إلى المخزون تلقائياً
                </p>
              </div>
            </CardContent>
          </Card>

          {/* قائمة المنتجات */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-3">منتجات الطلب:</h4>
              <div className="space-y-2">
                {(order?.items || []).map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span>{item.name}</span>
                    <span className="text-sm text-muted-foreground">الكمية: {item.quantity}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={handleProcessReturn}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الاستلام...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                استلام الراجع
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnReceiptDialog;