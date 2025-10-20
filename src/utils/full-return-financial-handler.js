import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة مالية للإرجاع الكامل (بدون طلب أصلي)
 * @param {string} returnOrderId - معرف طلب الإرجاع
 * @param {number} refundAmount - المبلغ المسترد للزبون
 * @param {string} employeeId - معرف الموظف
 * @param {Function} calculateProfit - دالة حساب الربح من SuperProvider
 * @returns {Promise<{success: boolean, details?: object, error?: string}>}
 */
export const handleFullReturnFinancials = async (
  returnOrderId,
  refundAmount,
  employeeId,
  calculateProfit
) => {
  try {
    // 1️⃣ جلب تفاصيل طلب الإرجاع
    const { data: returnOrder, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          product:products(name, cost_price),
          variant:product_variants(cost_price, color:colors(name), size:sizes(name))
        )
      `)
      .eq('id', returnOrderId)
      .single();

    if (orderError) throw orderError;

    // 2️⃣ تسجيل كمصروف في accounting
    const { error: expenseError } = await supabase
      .from('accounting')
      .insert({
        type: 'expense',
        category: 'customer_refund',
        amount: Math.abs(refundAmount),
        description: `استرداد مبلغ للزبون - طلب إرجاع ${returnOrder.order_number}`,
        reference_id: returnOrderId,
        reference_type: 'return_order',
        created_by: employeeId,
        created_at: new Date().toISOString()
      });

    if (expenseError) throw expenseError;

    // 3️⃣ حساب خصم من ربح الموظف (إذا وجد)
    let employeeProfitToDeduct = 0;
    
    if (calculateProfit && typeof calculateProfit === 'function') {
      const tempOrder = {
        items: (returnOrder.order_items || []).map(item => ({
          product_id: item.product_id,
          sku: item.variant_id,
          price: item.unit_price,
          quantity: item.quantity,
          cost_price: item.variant?.cost_price || item.product?.cost_price || 0
        })),
        created_at: returnOrder.created_at,
        created_by: employeeId
      };

      employeeProfitToDeduct = calculateProfit(tempOrder, employeeId) || 0;
    }

    // 4️⃣ خصم من ربح الموظف في جدول profits (آخر سجل له)
    if (employeeProfitToDeduct > 0) {
      const { data: latestProfit } = await supabase
        .from('profits')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestProfit) {
        await supabase
          .from('profits')
          .update({
            employee_profit: Math.max(0, latestProfit.employee_profit - employeeProfitToDeduct),
            updated_at: new Date().toISOString()
          })
          .eq('id', latestProfit.id);
      }
    }

    // 5️⃣ تحديث ملاحظات الطلب
    await supabase
      .from('orders')
      .update({
        notes: `${returnOrder.notes || ''}\n[إرجاع كامل] مبلغ مسترد: ${refundAmount.toLocaleString()} د.ع - خصم من ربح الموظف: ${employeeProfitToDeduct.toLocaleString()} د.ع`,
        updated_at: new Date().toISOString()
      })
      .eq('id', returnOrderId);

    return {
      success: true,
      details: {
        refundAmount,
        employeeProfitDeducted: employeeProfitToDeduct,
        expenseRecorded: true
      }
    };
  } catch (error) {
    console.error('❌ خطأ في معالجة الإرجاع الكامل المالي:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
