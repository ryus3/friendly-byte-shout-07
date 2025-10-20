import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة مالية للإرجاع الكامل - مُحدّث لحالة 17
 * يبحث عن الطلب الأصلي تلقائياً ويخصم من أرباحه
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

    // 2️⃣ البحث عن الطلب الأصلي من ai_orders
    let originalOrderId = null;
    const { data: aiOrder } = await supabase
      .from('ai_orders')
      .select('original_order_id')
      .eq('id', returnOrderId)
      .maybeSingle();
    
    if (aiOrder?.original_order_id) {
      originalOrderId = aiOrder.original_order_id;
    } else if (returnOrder.customer_phone) {
      // البحث عن آخر طلب مُسلّم للزبون
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_phone', returnOrder.customer_phone)
        .in('status', ['delivered', 'completed'])
        .neq('order_type', 'return')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastOrder) {
        originalOrderId = lastOrder.id;
        
        // تحديث ai_orders بالربط
        await supabase
          .from('ai_orders')
          .update({ original_order_id: originalOrderId })
          .eq('id', returnOrderId);
      }
    }

    // 3️⃣ خصم من الطلب الأصلي أو تسجيل كمصروف
    let employeeProfitDeducted = 0;
    let systemProfitDeducted = 0;
    let accountingType = 'expense';
    let accountingCategory = 'customer_refund';
    
    if (originalOrderId) {
      // ✅ الطلب الأصلي موجود - خصم من أرباحه
      const { data: originalProfit } = await supabase
        .from('profits')
        .select('*')
        .eq('order_id', originalOrderId)
        .maybeSingle();
      
      if (originalProfit) {
        // حساب الخصم
        employeeProfitDeducted = (Math.abs(refundAmount) * (originalProfit.employee_percentage || 0)) / 100;
        systemProfitDeducted = Math.abs(refundAmount) - employeeProfitDeducted;
        
        // تحديث الأرباح
        await supabase
          .from('profits')
          .update({
            total_revenue: Math.max(0, originalProfit.total_revenue - Math.abs(refundAmount)),
            profit_amount: Math.max(0, originalProfit.profit_amount - Math.abs(refundAmount)),
            employee_profit: Math.max(0, originalProfit.employee_profit - employeeProfitDeducted),
            updated_at: new Date().toISOString()
          })
          .eq('id', originalProfit.id);
        
        accountingType = 'adjustment';
        accountingCategory = 'return_deduction';
      }
    }
    
    // 4️⃣ تسجيل في accounting
    const { error: accountingError } = await supabase
      .from('accounting')
      .insert({
        type: accountingType,
        category: accountingCategory,
        amount: Math.abs(refundAmount),
        description: originalOrderId 
          ? `خصم بسبب إرجاع - الطلب الأصلي: ${originalOrderId}`
          : `استرداد مبلغ للزبون (بدون طلب أصلي) - طلب إرجاع ${returnOrder.order_number}`,
        reference_id: originalOrderId || returnOrderId,
        reference_type: originalOrderId ? 'order_return' : 'return_order',
        created_by: employeeId,
        created_at: new Date().toISOString()
      });

    if (accountingError) throw accountingError;

    // 5️⃣ تسجيل في return_history
    const { error: historyError } = await supabase
      .from('return_history')
      .insert({
        return_order_id: returnOrderId,
        original_order_id: originalOrderId,
        refund_amount: Math.abs(refundAmount),
        delivery_fee: returnOrder.delivery_fee || 0,
        employee_profit_deducted: employeeProfitDeducted,
        system_profit_deducted: systemProfitDeducted,
        financial_handler_success: true,
        status_17_at: new Date().toISOString(),
        created_by: employeeId
      });
    
    if (historyError) {
      console.warn('⚠️ فشل تسجيل في return_history:', historyError);
    }

    // 6️⃣ تحديث ملاحظات الطلب
    await supabase
      .from('orders')
      .update({
        notes: `${returnOrder.notes || ''}\n[إرجاع كامل - حالة 17] مبلغ مسترد: ${Math.abs(refundAmount).toLocaleString()} د.ع - خصم من ربح الموظف: ${employeeProfitDeducted.toLocaleString()} د.ع${originalOrderId ? ` - الطلب الأصلي: ${originalOrderId}` : ''}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', returnOrderId);

    // 7️⃣ إرسال إشعار للموظف
    await supabase
      .from('notifications')
      .insert({
        user_id: employeeId,
        type: 'return_processed',
        title: 'تم معالجة طلب الإرجاع',
        message: `تم خصم ${Math.abs(refundAmount).toLocaleString()} د.ع من ${originalOrderId ? 'الطلب الأصلي' : 'حسابك'} - طلب الإرجاع: ${returnOrder.order_number}`,
        data: {
          return_order_id: returnOrderId,
          original_order_id: originalOrderId,
          refund_amount: Math.abs(refundAmount),
          employee_deduction: employeeProfitDeducted
        }
      });

    return {
      success: true,
      details: {
        refundAmount: Math.abs(refundAmount),
        employeeProfitDeducted,
        systemProfitDeducted,
        originalOrderId,
        accountingType,
        linkedToOriginal: !!originalOrderId
      }
    };
  } catch (error) {
    console.error('❌ خطأ في معالجة الإرجاع الكامل المالي:', error);
    
    // تسجيل الخطأ في return_history
    try {
      await supabase
        .from('return_history')
        .insert({
          return_order_id: returnOrderId,
          refund_amount: Math.abs(refundAmount),
          financial_handler_success: false,
          error_message: error.message,
          status_17_at: new Date().toISOString(),
          created_by: employeeId
        });
    } catch (histError) {
      console.error('❌ فشل تسجيل الخطأ في return_history:', histError);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};
