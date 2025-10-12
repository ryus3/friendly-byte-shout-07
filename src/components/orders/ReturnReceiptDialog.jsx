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

      // ✅ فحص: هل مرّ الطلب بحالة 21 (return_pending)؟
      const { data: statusHistory } = await supabase
        .from('order_status_history')
        .select('new_status, new_delivery_status')
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false });
      
      const hasPassed21 = statusHistory?.some(
        h => h.new_status === 'return_pending' || h.new_delivery_status === '21'
      ) || order.status === 'return_pending' || order.delivery_status === '21';

      // ✅ معالجة المخزون فقط إذا مرّ بحالة 21
      if (hasPassed21) {
        // إضافة المنتجات للمخزون باستخدام RPC
        for (const item of orderItems) {
          const { error: stockError } = await supabase.rpc('update_variant_stock', {
            p_variant_id: item.variant_id,
            p_quantity_change: item.quantity,
            p_reason: `إرجاع للمخزون - ${order.tracking_number}`
          });

          if (stockError) {
            console.error('خطأ في إضافة المخزون:', stockError);
          } else {
            console.log(`✅ تم إرجاع ${item.quantity} قطعة للمخزون`);
          }
        }

        // ✅ معالجة المحاسبة تلقائياً
        if (order.original_order_id && order.final_amount < 0) {
          const { error: financialError } = await supabase.rpc('adjust_profit_for_return_v2', {
            p_original_order_id: order.original_order_id,
            p_refund_amount: Math.abs(order.final_amount),
            p_product_profit: 0, // سيحسبه النظام
            p_return_order_id: order.id
          });

          if (financialError) {
            console.error('خطأ في المعالجة المالية:', financialError);
          } else {
            console.log('✅ تم تعديل الأرباح تلقائياً');
          }
        }

        console.log('✅ تم إرجاع المنتجات للمخزون - الطلب مرّ بحالة 21');
      } else {
        console.log('⚠️ إلغاء إرجاع - الطلب لم يمر بحالة 21 - لا تحديث للمخزون');
      }

      // تحديث حالة الطلب إلى "مستلم الراجع"
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'return_received',
          delivery_status: '17', // ✅ حالة الوسيط 17
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) {
        throw new Error(`خطأ في تحديث حالة الطلب: ${orderError.message}`);
      }

      // ✅ المرحلة 4: تحديث حالة حركة النقد عند الاستلام
      if (hasPassed21) {
        await supabase
          .from('cash_movements')
          .update({ 
            description: `إرجاع للزبون - طلب #${order.tracking_number} - ✅ تم الدفع عند الاستلام`
          })
          .eq('reference_id', order.id)
          .eq('reference_type', 'order')
          .eq('movement_type', 'withdrawal');
      }

      toast({
        title: hasPassed21 ? "✅ تم استلام الراجع بنجاح" : "⚠️ تم إلغاء الإرجاع",
        description: hasPassed21 
          ? (
            <div className="space-y-1 text-sm">
              <p>• تم إرجاع المنتجات للمخزون</p>
              <p>• تم تسجيل دفع المبلغ للزبون</p>
            </div>
          )
          : "تم تحديث الحالة بدون معالجة المخزون",
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