import { supabase } from '@/lib/customSupabaseClient';
import devLog from '@/lib/devLogger';

/**
 * معالجة الحسابات المالية للتسليم الجزئي
 * @param {string} orderId - معرف الطلب
 * @param {Array} deliveredItemIds - معرفات المنتجات المسلمة
 * @param {Function} calculateProfit - دالة حساب ربح الموظف من SuperProvider
 * @param {number} finalPrice - السعر النهائي (قابل للتعديل)
 * @returns {Promise<{success: boolean, profitId?: string, details?: object, error?: string}>}
 */
export const handlePartialDeliveryFinancials = async (
  orderId,
  deliveredItemIds,
  calculateProfit,
  finalPrice = null
) => {
  try {
    // 1️⃣ جلب تفاصيل الطلب والمنتجات المسلمة
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          product:products(name, cost_price),
          variant:product_variants(cost_price, color:colors(name), size:sizes(name))
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    // 2️⃣ تصفية المنتجات المسلمة فقط
    const deliveredItems = (order.order_items || []).filter(item =>
      deliveredItemIds.includes(item.id)
    );

    if (!deliveredItems.length) {
      return { success: false, error: 'لا توجد منتجات مسلمة' };
    }

    // 3️⃣ حساب الإيرادات والتكاليف للمنتجات المسلمة فقط
    // ✅ السعر النهائي المؤكد من المستخدم (يطابق ما ترسله شركة التوصيل) — هو مصدر الحقيقة
    const useFinalPrice = finalPrice !== null && finalPrice !== undefined;
    const confirmedFinalAmount = useFinalPrice
      ? Number(finalPrice)
      : Number(order.final_amount || order.total_amount || 0);

    devLog.log('💰 حساب الماليات (التسليم الجزئي):', {
      useFinalPrice,
      confirmedFinalAmount,
      orderFinalAmount: order.final_amount,
      orderTotalAmount: order.total_amount
    });

    // تكلفة المنتجات المُسلّمة
    let totalCost = 0;
    let deliveredItemsPrice = 0;
    deliveredItems.forEach(item => {
      deliveredItemsPrice += (item.unit_price || 0) * (item.quantity || 0);
      totalCost += ((item.variant?.cost_price || item.product?.cost_price || 0)) * (item.quantity || 0);
    });

    // 🔥 الإيراد المؤكد = السعر النهائي الذي كتبه المستخدم (شامل التوصيل) — هو ما ترسله شركة التوصيل
    const allocatedDeliveryFee = deliveredItems.length > 0 ? Number(order.delivery_fee || 0) : 0;
    // إيراد المنتجات بدون التوصيل = السعر النهائي - رسوم التوصيل (لا يقل عن سعر المنتجات الأصلي)
    const productsRevenueFromFinal = Math.max(0, confirmedFinalAmount - allocatedDeliveryFee);
    const totalRevenue = productsRevenueFromFinal; // بدون التوصيل (يضاف لاحقاً في الـ profit)

    devLog.log('💰 الإيراد المؤكد:', { confirmedFinalAmount, productsRevenueFromFinal, allocatedDeliveryFee, deliveredItemsPrice });

    // 4️⃣ حساب ربح الموظف للمنتجات المسلمة فقط (يبقى على سعر المنتجات الأصلي حتى لا يتأثر بزيادة شركة التوصيل)
    const employeeId = order.created_by;
    let employeeProfit = 0;

    if (calculateProfit && typeof calculateProfit === 'function') {
      const processingDate = new Date().toISOString();
      const tempOrder = {
        ...order,
        items: deliveredItems.map(item => ({
          product_id: item.product_id,
          sku: item.variant_id,
          price: item.unit_price,
          quantity: item.quantity,
          cost_price: item.variant?.cost_price || item.product?.cost_price || 0,
          orderDate: processingDate
        })),
        created_at: processingDate,
        created_by: employeeId
      };
      employeeProfit = calculateProfit(tempOrder, employeeId) || 0;
    }

    // 5️⃣ ربح النظام = (الإيراد الكلي بدون التوصيل) - التكلفة - ربح الموظف
    // أي زيادة من شركة التوصيل تذهب لربح النظام
    const systemProfit = totalRevenue - totalCost - employeeProfit;

    // 7️⃣ إنشاء أو تحديث سجل الربح
    const { data: existingProfit } = await supabase
      .from('profits')
      .select('id, total_revenue, total_cost, profit_amount, employee_profit')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingProfit) {
      // ✅ تحديث سجل الربح الموجود (للمنتجات المسلمة فقط)
      const { error: updateError } = await supabase
        .from('profits')
        .update({
          total_revenue: totalRevenue + allocatedDeliveryFee,
          total_cost: totalCost,
          profit_amount: systemProfit,
          employee_profit: employeeProfit,
          status: 'pending', // انتظار استلام الفاتورة
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProfit.id);

      if (updateError) throw updateError;

      // ✅ تسجيل في partial_delivery_history
      // 🔥 Trigger التزامن سيحدث orders.final_amount تلقائياً
      await supabase
        .from('partial_delivery_history')
        .insert({
          order_id: orderId,
          delivered_items: deliveredItems.map(i => ({
            id: i.id,
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
            unit_price: i.unit_price
          })),
          undelivered_items: (order.order_items || [])
            .filter(item => !deliveredItemIds.includes(item.id))
            .map(i => ({
              id: i.id,
              product_id: i.product_id,
              variant_id: i.variant_id,
              quantity: i.quantity,
              unit_price: i.unit_price
            })),
          delivered_revenue: totalRevenue + allocatedDeliveryFee,
          delivered_cost: totalCost,
          employee_profit: employeeProfit,
          system_profit: systemProfit,
          delivery_fee_allocated: allocatedDeliveryFee,
          processed_by: employeeId
        });

      // ✅ إضافة إشعار بعد النجاح
      await supabase
        .from('notifications')
        .insert({
          user_id: employeeId,
          type: 'partial_delivery',
          title: 'تسليم جزئي ✅',
          message: `تم معالجة تسليم جزئي للطلب #${order.tracking_number || order.order_number}\n` +
                   `• ${deliveredItems.length} منتج مُسلّم\n` +
                   `• الإيراد: ${(totalRevenue + allocatedDeliveryFee).toLocaleString()} د.ع\n` +
                   `• ربحك: ${employeeProfit.toLocaleString()} د.ع`,
          data: {
            order_id: orderId,
            delivered_count: deliveredItems.length,
            total_revenue: totalRevenue + allocatedDeliveryFee,
            employee_profit: employeeProfit
          }
        });

      return { 
        success: true, 
        profitId: existingProfit.id,
        details: {
          totalRevenue: totalRevenue + allocatedDeliveryFee,
          totalCost,
          systemProfit,
          employeeProfit,
          deliveredItemsCount: deliveredItems.length
        }
      };
    } else {
      // ✅ إنشاء سجل ربح جديد (للمنتجات المسلمة فقط)
      const { data: newProfit, error: insertError } = await supabase
        .from('profits')
        .insert({
          order_id: orderId,
          employee_id: employeeId,
          total_revenue: totalRevenue + allocatedDeliveryFee,
          total_cost: totalCost,
          profit_amount: systemProfit,
          employee_percentage: 0, // لا نستخدم النسبة المئوية
          employee_profit: employeeProfit,
          status: 'pending', // انتظار استلام الفاتورة
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // ✅ تسجيل في partial_delivery_history
      // 🔥 Trigger التزامن سيحدث orders.final_amount تلقائياً
      await supabase
        .from('partial_delivery_history')
        .insert({
          order_id: orderId,
          delivered_items: deliveredItems.map(i => ({
            id: i.id,
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
            unit_price: i.unit_price
          })),
          undelivered_items: (order.order_items || [])
            .filter(item => !deliveredItemIds.includes(item.id))
            .map(i => ({
              id: i.id,
              product_id: i.product_id,
              variant_id: i.variant_id,
              quantity: i.quantity,
              unit_price: i.unit_price
            })),
          delivered_revenue: totalRevenue + allocatedDeliveryFee,
          delivered_cost: totalCost,
          employee_profit: employeeProfit,
          system_profit: systemProfit,
          delivery_fee_allocated: allocatedDeliveryFee,
          processed_by: employeeId
        });

      // ✅ إضافة إشعار بعد النجاح
      await supabase
        .from('notifications')
        .insert({
          user_id: employeeId,
          type: 'partial_delivery',
          title: 'تسليم جزئي ✅',
          message: `تم معالجة تسليم جزئي للطلب #${order.tracking_number || order.order_number}\n` +
                   `• ${deliveredItems.length} منتج مُسلّم\n` +
                   `• الإيراد: ${(totalRevenue + allocatedDeliveryFee).toLocaleString()} د.ع\n` +
                   `• ربحك: ${employeeProfit.toLocaleString()} د.ع`,
          data: {
            order_id: orderId,
            delivered_count: deliveredItems.length,
            total_revenue: totalRevenue + allocatedDeliveryFee,
            employee_profit: employeeProfit
          }
        });

      return { 
        success: true, 
        profitId: newProfit.id,
        details: {
          totalRevenue: totalRevenue + allocatedDeliveryFee,
          totalCost,
          systemProfit,
          employeeProfit,
          deliveredItemsCount: deliveredItems.length
        }
      };
    }
  } catch (error) {
    console.error('❌ خطأ في معالجة التسليم الجزئي المالي:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
