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
  const [customPrice, setCustomPrice] = useState(null); // للسماح بتعديل السعر

  useEffect(() => {
    if (open && order) {
      // ✅ فحص: هل تم معالجة هذا الطلب مسبقاً؟
      const alreadyProcessed = order.status === 'partial_delivery' && 
                               order.delivery_status === '21';
      
      if (!alreadyProcessed) {
        fetchOrderItems();
        setCustomPrice(null);
      } else {
        // إغلاق النافذة تلقائياً - الطلب تم معالجته
        toast({
          title: 'تنبيه',
          description: 'هذا الطلب تم معالجته كتسليم جزئي مسبقاً',
          variant: 'default'
        });
        onOpenChange(false);
      }
    }
  }, [open, order?.id, order?.status, order?.delivery_status]);

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
      // لا تختار أي منتج افتراضياً - دع المستخدم يختار
      setSelectedItems([]);
    }
  };

  const toggleItem = (itemId) => {
    console.log('🔄 تبديل اختيار المنتج:', itemId);
    setSelectedItems(prev => {
      const newSelection = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      console.log('✅ الاختيار الجديد:', newSelection);
      return newSelection;
    });
  };

  const calculateExpectedPrice = () => {
    const selectedItemsData = items.filter(item => selectedItems.includes(item.id));
    
    // حساب سعر المنتجات
    const itemsTotal = selectedItemsData.reduce((sum, item) => 
      sum + (item.unit_price * item.quantity), 0
    );
    
    // ✅ رسوم التوصيل كاملة إذا تم اختيار أي منتج
    const deliveryFee = selectedItemsData.length > 0 
      ? Number(order?.delivery_fee || 0) 
      : 0;
    
    const total = itemsTotal + deliveryFee;
    
    console.log('💰 حساب السعر:', {
      selectedCount: selectedItemsData.length,
      itemsTotal,
      deliveryFee,
      total
    });
    
    return total;
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
        totalItemsCount: items.length,
        selectedItems,
        unselectedItems: items.filter(item => !selectedItems.includes(item.id)).map(i => i.id)
      });

      // 1️⃣ تحديث المنتجات المُختارة إلى 'delivered' (كل منتج على حدة)
      for (const itemId of selectedItems) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;

        const { error: deliveredError } = await supabase
          .from('order_items')
          .update({ 
            item_status: 'delivered',
            quantity_delivered: item.quantity,
            delivered_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (deliveredError) {
          console.error(`❌ خطأ في تحديث المنتج ${item.product?.name}:`, deliveredError);
          throw deliveredError;
        }
      }

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
            item_status: 'pending_return'
          })
          .in('id', unselectedItems);

        if (pendingReturnError) {
          console.error('❌ خطأ في تحديث المنتجات غير المُسلّمة:', pendingReturnError);
        } else {
          console.log(`✅ تم تحديث ${unselectedItems.length} منتج إلى pending_return`);
        }
      }

      // 4️⃣ معالجة الحسابات المالية (باستخدام السعر المخصص إن وُجد)
      const finalPrice = customPrice ?? expectedPrice;
      const deliveredItemIds = selectedItems;
      const financialResult = await handlePartialDeliveryFinancials(
        order.id,
        deliveredItemIds,
        calculateProfit,
        finalPrice // تمرير السعر النهائي
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

      // 5️⃣ ✅ تحديث حالة الطلب الرئيسي والمبالغ
      const newOrderStatus = unselectedItems.length > 0 
        ? 'partial_delivery' 
        : 'delivered';

      // حساب المبالغ الصحيحة
      const deliveredItemsTotal = items
        .filter(item => selectedItems.includes(item.id))
        .reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

      const originalTotal = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
      const newDiscount = Math.max(0, originalTotal - finalPrice);

      await supabase
        .from('orders')
        .update({
          status: newOrderStatus,
          total_amount: deliveredItemsTotal,  // سعر المنتجات المُسلّمة فقط
          final_amount: finalPrice,           // السعر النهائي الكامل
          discount: newDiscount,              // الفرق كخصم
          price_change_type: null,            // إزالة العلامة المؤقتة
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      onConfirm?.();
      onOpenChange(false);
    } catch (error) {
      console.error('💥 خطأ في تحديث المنتجات:', error);
      console.error('Stack trace:', error.stack);
      console.error('Error details:', {
        message: error.message,
        orderId: order?.id,
        selectedItemsCount: selectedItems.length
      });
      toast({
        title: 'خطأ',
        description: `حدث خطأ: ${error.message}`,
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

          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>المنتجات المُختارة:</span>
              <span className="font-semibold">{selectedItems.length} / {items.length}</span>
            </div>
            
            {/* تفاصيل السعر */}
            <div className="border-t border-border pt-2 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>سعر المنتجات:</span>
                <span>
                  {items
                    .filter(item => selectedItems.includes(item.id))
                    .reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
                    .toLocaleString()} د.ع
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>رسوم التوصيل:</span>
                <span>
                  {selectedItems.length > 0 
                    ? Number(order?.delivery_fee || 0).toLocaleString() 
                    : 0} د.ع
                </span>
              </div>
            </div>
            
            {/* السعر النهائي القابل للتعديل */}
            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">السعر النهائي (شامل التوصيل):</label>
                <input
                  type="number"
                  value={customPrice ?? expectedPrice}
                  onChange={(e) => setCustomPrice(e.target.value ? Number(e.target.value) : null)}
                  className="w-32 px-2 py-1 text-sm font-bold text-right bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={expectedPrice.toLocaleString()}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                السعر المتوقع: {expectedPrice.toLocaleString()} د.ع
              </p>
            </div>
            
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span>سعر شركة التوصيل:</span>
              <span className="font-semibold">
                {apiPrice.toLocaleString()} د.ع
              </span>
            </div>
            
            {/* تحذير فرق السعر */}
            {Math.abs((customPrice ?? expectedPrice) - apiPrice) > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-md">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    فرق السعر: {Math.abs((customPrice ?? expectedPrice) - apiPrice).toLocaleString()} د.ع
                  </p>
                  <p className="text-amber-700 dark:text-amber-400">
                    {(customPrice ?? expectedPrice) > apiPrice ? 'زيادة' : 'خصم'} عن سعر شركة التوصيل
                  </p>
                </div>
              </div>
            )}
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
