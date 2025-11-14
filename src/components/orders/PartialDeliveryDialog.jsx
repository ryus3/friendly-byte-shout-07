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
      console.log('🔄 بدء معالجة التسليم الجزئي...', {
        orderId: order.id,
        orderNumber: order.order_number,
        deliveryStatus: order.delivery_status,
        selectedItemsCount: selectedItems.length,
        totalItemsCount: items.length
      });

      // 1️⃣ تحديث المنتجات المُختارة إلى 'delivered'
      const { error: deliveredError } = await supabase
        .from('order_items')
        .update({ 
          item_status: 'delivered',
          quantity_delivered: items.find(i => selectedItems.includes(i.id))?.quantity,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', selectedItems);

      if (deliveredError) throw deliveredError;

      // 2️⃣ تحرير المخزون للمنتجات المُسلّمة (من reserved إلى sold)
      for (const itemId of selectedItems) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;

        const { error: stockError } = await supabase.rpc('release_stock_item', {
          p_product_id: item.product_id,
          p_variant_id: item.variant_id,
          p_quantity: item.quantity
        });

        if (stockError) {
          console.error(`❌ خطأ في تحرير المخزون للمنتج ${item.product?.name}:`, stockError);
        } else {
          console.log(`✅ تم تحرير المخزون: ${item.product?.name} × ${item.quantity}`);
        }
      }

      // 3️⃣ تحديث المنتجات غير المُختارة إلى 'pending_return'
      const unselectedItems = items
        .filter(item => !selectedItems.includes(item.id))
        .map(item => item.id);

      if (unselectedItems.length > 0) {
        const { error: pendingReturnError } = await supabase
          .from('order_items')
          .update({ 
            item_status: 'pending_return',
            updated_at: new Date().toISOString()
          })
          .in('id', unselectedItems);

        if (pendingReturnError) {
          console.error('❌ خطأ في تحديث المنتجات غير المُسلّمة:', pendingReturnError);
        } else {
          console.log(`✅ تم تحديث ${unselectedItems.length} منتج إلى pending_return`);
        }
      }

      // 4️⃣ معالجة الحسابات المالية
      const deliveredItemIds = selectedItems;
      const financialResult = await handlePartialDeliveryFinancials(
        order.id,
        deliveredItemIds,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-right flex items-center gap-3 justify-end">
            <span>
              {order?.delivery_status === '21' 
                ? 'اختر المنتجات المُسلّمة للزبون' 
                : 'تحديد المنتجات المُسلّمة'}
            </span>
            <Package className="w-8 h-8 text-primary" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {order?.delivery_status === '21' && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    📦 تسليم جزئي - استرجاع من العميل
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    ✅ اختر المنتجات التي <strong>تم بيعها وتسليمها</strong> للزبون
                    <br />
                    ⏳ المنتجات الأخرى ستبقى <strong>محجوزة</strong> حتى تصل بالحالة 17 (مرتجع في المخزون)
                  </p>
                </div>
              </div>
            </div>
          )}

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
                  id={item.id}
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

                <label
                  htmlFor={item.id}
                  className="text-xs font-medium cursor-pointer"
                >
                  {order?.delivery_status === '21' 
                    ? '✅ تم بيعه' 
                    : 'تم التسليم'}
                </label>

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
              <span className="font-semibold">
                {apiPrice.toLocaleString()} د.ع
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedItems.length === 0 || loading}
              className="flex-1"
            >
              {loading ? 'جاري المعالجة...' : 'تأكيد التسليم الجزئي'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
