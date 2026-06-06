import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, CheckCircle2, Minus, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { handlePartialDeliveryFinancials } from '@/utils/partial-delivery-financial-handler';
import { useSuper } from '@/contexts/SuperProvider';

/**
 * نافذة التسليم الجزئي:
 * - تعرض لكل سطر منتج حقل كمية مباعة (0..quantity).
 * - عند التأكيد تقسم الأسطر التي مباعها أقل من كميتها إلى سطرين:
 *   سطر delivered للقطع المباعة + سطر pending_return للقطع المتبقية.
 * - تحرر المخزون المحجوز للقطع المباعة فقط، وتبقي الباقي محجوزاً حتى الحالة 17.
 */
export const PartialDeliveryDialog = ({ open, onOpenChange, order, onConfirm }) => {
  const { calculateProfit } = useSuper();
  const [items, setItems] = useState([]);
  // selections: { [item_id]: deliveredQty }
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(false);
  const [customPrice, setCustomPrice] = useState(null);

  useEffect(() => {
    if (!open || !order) return;
    const hasProcessedItems = order.order_items?.some(it =>
      it.item_status === 'delivered' || it.item_status === 'pending_return' || it.item_status === 'returned_in_stock'
    );
    const alreadyProcessed = (order.order_type === 'partial_delivery' || order.is_partial_delivery) && hasProcessedItems;
    if (alreadyProcessed) {
      toast({ title: 'تنبيه', description: 'هذا الطلب تم معالجته كتسليم جزئي مسبقاً' });
      onOpenChange(false);
      return;
    }
    fetchOrderItems();
    setCustomPrice(null);
  }, [open, order?.id]);

  const fetchOrderItems = async () => {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products(name, barcode),
        variant:product_variants(barcode, color:colors(name), size:sizes(name))
      `)
      .eq('order_id', order.id)
      .neq('item_status', 'returned_in_stock');
    if (!error && data) {
      // افتراضياً: لا شيء مباع — يختار المستخدم
      const init = {};
      data.forEach(it => { init[it.id] = 0; });
      setItems(data);
      setSelections(init);
    }
  };

  const setQty = (itemId, qty) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const clamped = Math.max(0, Math.min(Number(qty) || 0, Number(item.quantity) || 0));
    setSelections(prev => ({ ...prev, [itemId]: clamped }));
  };

  const totals = useMemo(() => {
    const deliveredQty = Object.values(selections).reduce((s, v) => s + (Number(v) || 0), 0);
    const itemsPrice = items.reduce((sum, it) => sum + ((Number(selections[it.id]) || 0) * Number(it.unit_price || 0)), 0);
    const deliveryFee = deliveredQty > 0 ? Number(order?.delivery_fee || 0) : 0;
    return { deliveredQty, itemsPrice, deliveryFee, expected: itemsPrice + deliveryFee };
  }, [selections, items, order?.delivery_fee]);

  const apiPrice = order?.final_amount || order?.total_amount || 0;
  const priceMismatch = Math.abs(totals.expected - apiPrice) > 100;
  const finalPrice = customPrice ?? totals.expected;

  const handleConfirm = async () => {
    if (totals.deliveredQty === 0) {
      toast({ title: 'خطأ', description: 'حدد كمية منتج واحدة على الأقل', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const deliveredItemIds = [];

      for (const item of items) {
        const qty = Number(selections[item.id]) || 0;
        const full = Number(item.quantity) || 0;
        const unit = Number(item.unit_price) || 0;

        if (qty === 0) {
          // كله غير مباع → pending_return
          await supabase.from('order_items').update({ item_status: 'pending_return' }).eq('id', item.id);
        } else if (qty === full) {
          // كله مباع
          await supabase.from('order_items').update({
            item_status: 'delivered',
            quantity_delivered: full,
            delivered_at: new Date().toISOString()
          }).eq('id', item.id);
          await supabase.rpc('release_stock_item', {
            p_variant_id: item.variant_id, p_quantity: full, p_order_id: order.id, p_reason: 'partial_delivery: sold full line'
          });
          deliveredItemIds.push(item.id);
        } else {
          // قسم السطر: المباع + pending_return للباقي
          const remaining = full - qty;
          // 1) السطر الحالي = المباع
          await supabase.from('order_items').update({
            quantity: qty,
            total_price: qty * unit,
            item_status: 'delivered',
            quantity_delivered: qty,
            delivered_at: new Date().toISOString()
          }).eq('id', item.id);
          // 2) إنشاء سطر جديد للقطع غير المباعة
          const { data: insertedRow } = await supabase.from('order_items').insert({
            order_id: order.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: remaining,
            unit_price: unit,
            total_price: remaining * unit,
            item_status: 'pending_return',
            item_direction: item.item_direction || 'outgoing'
          }).select('id').maybeSingle();
          // 3) تحرير المحجوز للقطع المباعة فقط
          await supabase.rpc('release_stock_item', {
            p_variant_id: item.variant_id, p_quantity: qty, p_order_id: order.id, p_reason: 'partial_delivery: sold part of line'
          });
          deliveredItemIds.push(item.id);
        }
      }

      // الماليات
      const financialResult = await handlePartialDeliveryFinancials(
        order.id, deliveredItemIds, calculateProfit, finalPrice
      );
      if (!financialResult.success) {
        toast({ title: 'تحذير', description: 'تم تحديث المخزون، لكن فشل حساب الأرباح', variant: 'warning' });
      }

      // تحديث الطلب
      const anyUnsold = items.some(it => (Number(selections[it.id]) || 0) < (Number(it.quantity) || 0));
      const deliveredItemsTotal = totals.itemsPrice;
      await supabase.from('orders').update({
        status: anyUnsold ? 'partial_delivery' : 'delivered',
        order_type: anyUnsold ? 'partial_delivery' : 'regular',
        is_partial_delivery: anyUnsold,
        total_amount: deliveredItemsTotal,
        final_amount: finalPrice,
        discount: 0,
        price_change_type: null,
        updated_at: new Date().toISOString()
      }).eq('id', order.id);

      toast({ title: 'تم ✅', description: `تم تأكيد بيع ${totals.deliveredQty} قطعة بنجاح` });
      onConfirm?.();
      onOpenChange(false);
    } catch (err) {
      console.error('partial delivery error', err);
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) onOpenChange(v); }}>
      <DialogContent
        className="max-w-2xl max-h-[92vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-right flex items-center gap-3 justify-end">
            <span>تحديد الكميات المُسلَّمة للزبون</span>
            <Package className="w-7 h-7 text-primary" />
          </DialogTitle>
          {(order?.tracking_number || order?.customer_phone) && (
            <div className="text-right text-xs text-muted-foreground mt-1">
              {order?.tracking_number && <span className="font-semibold text-foreground">طلب #{order.tracking_number}</span>}
              {order?.customer_phone && <span dir="ltr" className="text-primary mr-2">📞 {order.customer_phone}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4" dir="rtl">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
            اختر كم قطعة من كل منتج تم بيعها فعلاً للزبون. الكمية غير المباعة تبقى محجوزة حتى تصل بحالة 17 (راجع للمخزن).
          </div>

          <div className="space-y-2">
            {items.map(item => {
              const qty = Number(selections[item.id]) || 0;
              const full = Number(item.quantity) || 0;
              return (
                <div key={item.id} className="border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">
                        {item.product?.name || 'منتج'}
                        {item.variant?.color?.name && ` - ${item.variant.color.name}`}
                        {item.variant?.size?.name && ` - ${item.variant.size.name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        السعر للقطعة: {Number(item.unit_price).toLocaleString()} د.ع • الكمية الكلية: {full}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(item.id, qty - 1)} disabled={qty <= 0}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <input
                        type="number" min={0} max={full} value={qty}
                        onChange={(e) => setQty(item.id, e.target.value)}
                        className="w-14 text-center font-bold border rounded-md h-7 bg-background"
                      />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(item.id, qty + 1)} disabled={qty >= full}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground mr-1">/ {full}</span>
                    </div>
                  </div>
                  {qty > 0 && qty < full && (
                    <div className="mt-2 text-[11px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      مباع {qty} • راجع {full - qty}
                    </div>
                  )}
                  {qty === full && full > 0 && (
                    <div className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> الكمية كاملة مباعة
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs"><span>إجمالي القطع المباعة:</span><span className="font-bold">{totals.deliveredQty}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>سعر المنتجات المباعة:</span><span>{totals.itemsPrice.toLocaleString()} د.ع</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>رسوم التوصيل:</span><span>{totals.deliveryFee.toLocaleString()} د.ع</span></div>

            <div className="border-t pt-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium">السعر النهائي (شامل التوصيل):</label>
              <input
                type="number" value={customPrice ?? totals.expected}
                onChange={(e) => setCustomPrice(e.target.value ? Number(e.target.value) : null)}
                className="w-32 px-2 py-1 text-sm font-bold text-right bg-background border rounded-md"
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-right">السعر المتوقع: {totals.expected.toLocaleString()} د.ع</p>
            <div className="flex justify-between text-xs border-t pt-2"><span>سعر شركة التوصيل:</span><span className="font-semibold">{apiPrice.toLocaleString()} د.ع</span></div>
            {priceMismatch && (
              <div className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/20 rounded p-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>فرق بين المتوقع وسعر شركة التوصيل ({Math.abs(totals.expected - apiPrice).toLocaleString()} د.ع). تأكد قبل التأكيد.</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="flex-1">إلغاء</Button>
            <Button onClick={handleConfirm} disabled={loading || totals.deliveredQty === 0} className="flex-1">
              {loading ? 'جاري المعالجة...' : 'تأكيد التسليم الجزئي'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
