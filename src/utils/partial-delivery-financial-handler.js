import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة الحسابات المالية للتسليم الجزئي
 * @param {string} orderId - معرف الطلب
 * @param {Array} deliveredItemIds - معرفات المنتجات المسلمة
 * @param {Function} calculateProfit - دالة حساب ربح الموظف من SuperProvider
 * @returns {Promise<{success: boolean, profitId?: string, details?: object, error?: string}>}
 */
export const handlePartialDeliveryFinancials = async (
  orderId,
  deliveredItemIds,
  calculateProfit
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
    let totalRevenue = 0;
    let totalCost = 0;

    deliveredItems.forEach(item => {
      const itemRevenue = item.unit_price * item.quantity;
      const itemCost = (item.variant?.cost_price || item.product?.cost_price || 0) * item.quantity;
      
      totalRevenue += itemRevenue;
      totalCost += itemCost;
    });

    // 4️⃣ حساب ربح الموظف للمنتجات المسلمة فقط
    const employeeId = order.created_by;
    let employeeProfit = 0;

    if (calculateProfit && typeof calculateProfit === 'function') {
      // إنشاء طلب مؤقت يحتوي فقط على المنتجات المسلمة
      const tempOrder = {
        ...order,
        items: deliveredItems.map(item => ({
          product_id: item.product_id,
          sku: item.variant_id,
          price: item.unit_price,
          quantity: item.quantity,
          cost_price: item.variant?.cost_price || item.product?.cost_price || 0
        })),
        created_at: order.created_at,
        created_by: employeeId
      };

      employeeProfit = calculateProfit(tempOrder, employeeId) || 0;
    }

    // 5️⃣ حساب ربح النظام
    const systemProfit = totalRevenue - totalCost - employeeProfit;

    // 6️⃣ حساب نسبة رسوم التوصيل (تقسيم نسبي)
    const orderTotalRevenue = order.total_amount || 0;
    const deliveryFeeRatio = orderTotalRevenue > 0 
      ? totalRevenue / orderTotalRevenue 
      : 0;
    const allocatedDeliveryFee = (order.delivery_fee || 0) * deliveryFeeRatio;

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
