import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Package, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const ReturnReceiptDialog = ({ open, onClose, order, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderItems, setOrderItems] = useState([]);

  const handleProcessReturn = async () => {
    try {
      setIsProcessing(true);

      // تحديث المخزون لكل منتج في الطلب
      for (const item of orderItems) {
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
        const { data: currentInventory } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', item.product_id)
          .eq('variant_id', item.variant_id || null)
          .single();

        if (currentInventory) {
          await supabase
            .from('inventory')
            .update({
              quantity: currentInventory.quantity + item.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('product_id', item.product_id)
            .eq('variant_id', item.variant_id || null);
        }
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

  // جلب تفاصيل المنتجات مع الألوان والأحجام
  useEffect(() => {
    const fetchOrderItems = async () => {
      if (!order?.id) return;
      
      try {
        const { data: items, error } = await supabase
          .from('order_items')
          .select(`
            *,
            products!inner(name),
            product_variants(
              id,
              colors(name, hex_code),
              sizes(name)
            )
          `)
          .eq('order_id', order.id);

        if (error) {
          console.error('خطأ في جلب منتجات الطلب:', error);
          return;
        }

        setOrderItems(items || []);
      } catch (error) {
        console.error('خطأ في جلب تفاصيل المنتجات:', error);
      }
    };

    if (open && order?.id) {
      fetchOrderItems();
    }
  }, [open, order?.id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
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
                {orderItems.map((item, index) => (
                  <div key={index} className="bg-muted rounded-lg p-3 space-y-2">
                    <div className="font-medium text-base">{item.products?.name}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {item.product_variants?.colors?.name && (
                          <span className="inline-flex items-center gap-1">
                            <span 
                              className="w-4 h-4 rounded-full border border-border" 
                              style={{ backgroundColor: item.product_variants.colors.hex_code }}
                            ></span>
                            {item.product_variants.colors.name}
                          </span>
                        )}
                        {item.product_variants?.sizes?.name && (
                          <span className="bg-background px-2 py-1 rounded text-xs">
                            {item.product_variants.sizes.name}
                          </span>
                        )}
                      </div>
                      <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                        {item.quantity} قطعة
                      </div>
                    </div>
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