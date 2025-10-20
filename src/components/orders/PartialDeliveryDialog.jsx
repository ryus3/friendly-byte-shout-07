import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Package, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { handlePartialDeliveryFinancials } from '@/utils/partial-delivery-financial-handler';
import { useSuper } from '@/contexts/SuperProvider';

export const PartialDeliveryDialog = ({ open, onOpenChange, order, onConfirm }) => {
  const { calculateProfit } = useSuper();
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && order) {
      fetchOrderItems();
    }
  }, [open, order]);

  const fetchOrderItems = async () => {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products(name, barcode),
        variant:product_variants(
          barcode,
          color:colors(name),
          size:sizes(name)
        )
      `)
      .eq('order_id', order.id);

    if (!error && data) {
      setItems(data);
      // اختيار جميع المنتجات افتراضياً
      setSelectedItems(data.map(item => item.id));
    }
  };

  const toggleItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const calculateExpectedPrice = () => {
    return items
      .filter(item => selectedItems.includes(item.id))
      .reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  };

  const handleConfirm = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى تحديد المنتجات المُسلّمة',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // 1️⃣ تحديث حالة المنتجات المُسلّمة
      for (const itemId of selectedItems) {
        const item = items.find(i => i.id === itemId);
        await supabase
          .from('order_items')
          .update({
            item_status: 'delivered',
            quantity_delivered: item.quantity,
            delivered_at: new Date().toISOString()
          })
          .eq('id', itemId);

        // تحرير المخزون (خصم من الكمية الكلية)
        await supabase.rpc('release_stock_item', {
          p_product_id: item.product_id,
          p_variant_id: item.variant_id,
          p_quantity: item.quantity
        });
      }

      // 2️⃣ تحديث المنتجات غير المُسلّمة → pending_return
      const undeliveredIds = items
        .filter(item => !selectedItems.includes(item.id))
        .map(item => item.id);

      if (undeliveredIds.length > 0) {
        await supabase
          .from('order_items')
          .update({ item_status: 'pending_return' })
          .in('id', undeliveredIds);
      }

      // 3️⃣ ✅ معالجة الحسابات المالية للمنتجات المسلمة
      const financialResult = await handlePartialDeliveryFinancials(
        order.id,
        selectedItems,
        calculateProfit
      );

      if (!financialResult.success) {
        console.error('⚠️ فشل في معالجة الحسابات المالية:', financialResult.error);
        toast({
          title: 'تحذير',
          description: 'تم تحديث المخزون ولكن فشل في حساب الأرباح',
          variant: 'warning'
        });
      } else {
        const { details } = financialResult;
        toast({
          title: 'نجاح ✅',
          description: `تم تحرير ${selectedItems.length} منتج وحساب الأرباح بنجاح
          • الإيراد: ${details.totalRevenue.toLocaleString()} د.ع
          • ربح الموظف: ${details.employeeProfit.toLocaleString()} د.ع
          • ربح النظام: ${details.systemProfit.toLocaleString()} د.ع`,
        });
      }

      // 4️⃣ ✅ تحديث حالة الطلب الرئيسي
      const newOrderStatus = undeliveredIds.length > 0 
        ? 'partial_delivery' 
        : 'delivered';

      await supabase
        .from('orders')
        .update({
          status: newOrderStatus,
          price_change_type: null, // إزالة العلامة المؤقتة
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      onConfirm?.();
      onOpenChange(false);
    } catch (error) {
      console.error('خطأ في تحديث المنتجات:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ غير متوقع',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const expectedPrice = calculateExpectedPrice();
  const apiPrice = order?.final_amount || order?.total_amount || 0;
  const priceMismatch = Math.abs(expectedPrice - apiPrice) > 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            تحديد المنتجات المُسلّمة - طلب {order?.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {priceMismatch && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold">تحذير: عدم تطابق السعر</p>
                <p>
                  السعر المتوقع: {expectedPrice.toLocaleString()} د.ع
                  | سعر API: {apiPrice.toLocaleString()} د.ع
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className={`border rounded-lg p-3 flex items-center gap-3 transition-all ${
                  selectedItems.includes(item.id)
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800'
                    : 'bg-card border-border'
                }`}
              >
                <Checkbox
                  checked={selectedItems.includes(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {item.product?.name || 'منتج'}
                    {item.variant?.color?.name && ` - ${item.variant.color.name}`}
                    {item.variant?.size?.name && ` - ${item.variant.size.name}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    الكمية: {item.quantity} | السعر: {(item.unit_price * item.quantity).toLocaleString()} د.ع
                  </p>
                </div>

                {selectedItems.includes(item.id) && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>المنتجات المُختارة:</span>
              <span className="font-semibold">{selectedItems.length} / {items.length}</span>
            </div>
            <div className="flex justify-between">
              <span>السعر المتوقع:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {expectedPrice.toLocaleString()} د.ع
              </span>
            </div>
            <div className="flex justify-between">
              <span>سعر شركة التوصيل:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {apiPrice.toLocaleString()} د.ع
              </span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || selectedItems.length === 0}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {loading ? 'جاري التحديث...' : 'تأكيد التسليم الجزئي'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
