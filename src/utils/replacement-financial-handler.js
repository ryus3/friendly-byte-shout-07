import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة الحسابات المالية لطلبات الاستبدال
 * @param {Object} params - معاملات الاستبدال
 * @param {string} params.orderId - معرف الطلب
 * @param {string} params.originalOrderId - معرف الطلب الأصلي (للربط)
 * @param {number} params.priceDifference - فرق السعر (موجب = الزبون يدفع، سالب = نحن ندفع)
 * @param {number} params.deliveryFee - رسوم التوصيل (موجب/سالب)
 * @param {string} params.employeeId - معرف الموظف
 * @returns {Promise<{success: boolean, details: Object}>}
 */
export const handleReplacementFinancials = async ({
  orderId,
  originalOrderId,
  priceDifference,
  deliveryFee,
  employeeId
}) => {
  try {
    const results = {
      priceDifferenceHandled: false,
      deliveryFeeHandled: false,
      profitAdjusted: false,
      details: {}
    };

    // معالجة فرق السعر
    if (priceDifference !== 0) {
      if (priceDifference < 0) {
        // نحن ندفع للزبون - خصم من ربح الطلب الأصلي
        const refundAmount = Math.abs(priceDifference);
        
        // تسجيل كمصروف
        const { error: expenseError } = await supabase
          .from('accounting')
          .insert({
            type: 'expense',
            category: 'خصم استبدال',
            amount: refundAmount,
            description: `فرق سعر استبدال لصالح الزبون - طلب ${orderId}`,
            reference_type: 'order',
            reference_id: orderId,
            expense_type: 'replacement_refund'
          });

        if (expenseError) throw expenseError;

        // خصم من ربح الطلب الأصلي إذا كان موجوداً
        if (originalOrderId) {
          await adjustOriginalOrderProfit(originalOrderId, refundAmount);
        }

        results.priceDifferenceHandled = true;
        results.details.priceDifference = {
          type: 'refund',
          amount: refundAmount
        };
      } else {
        // الزبون يدفع - ربح للنظام (ليس للموظف)
        const { error: revenueError } = await supabase
          .from('accounting')
          .insert({
            type: 'revenue',
            category: 'أرباح استبدال',
            amount: priceDifference,
            description: `فرق سعر استبدال لصالح النظام - طلب ${orderId}`,
            reference_type: 'order',
            reference_id: orderId,
            revenue_type: 'replacement_profit'
          });

        if (revenueError) throw revenueError;

        results.priceDifferenceHandled = true;
        results.details.priceDifference = {
          type: 'profit',
          amount: priceDifference
        };
      }
    }

    // معالجة رسوم التوصيل
    if (deliveryFee !== 0) {
      if (deliveryFee > 0) {
        // رسوم موجبة - خصم من ربح الموظف
        await deductDeliveryFeeFromEmployeeProfit(employeeId, deliveryFee, orderId);
        
        results.deliveryFeeHandled = true;
        results.details.deliveryFee = {
          type: 'employee_deduction',
          amount: deliveryFee
        };
      } else {
        // رسوم سالبة - نحن ندفع (خصم من فاتورة الوسيط)
        const feeAmount = Math.abs(deliveryFee);
        
        const { error } = await supabase
          .from('accounting')
          .insert({
            type: 'expense',
            category: 'رسوم توصيل مخصومة من الفاتورة',
            amount: feeAmount,
            description: `رسوم توصيل استبدال سالبة - طلب ${orderId}`,
            reference_type: 'alwaseet_invoice',
            reference_id: orderId,
            expense_type: 'invoice_deduction'
          });

        if (error) throw error;

        // إضافة ملاحظة للطلب
        await supabase
          .from('orders')
          .update({
            notes: `خصم من فاتورة الوسيط: ${feeAmount} د.ع`
          })
          .eq('id', orderId);

        results.deliveryFeeHandled = true;
        results.details.deliveryFee = {
          type: 'invoice_deduction',
          amount: feeAmount
        };
      }
    }

    return {
      success: true,
      ...results
    };
  } catch (error) {
    console.error('Error handling replacement financials:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * خصم مبلغ من ربح الطلب الأصلي
 */
const adjustOriginalOrderProfit = async (originalOrderId, refundAmount) => {
  try {
    const { data: profitRecord, error: fetchError } = await supabase
      .from('profits')
      .select('*')
      .eq('order_id', originalOrderId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!profitRecord) return;

    const currentRevenue = profitRecord.total_revenue || 0;
    const currentProfit = profitRecord.profit_amount || 0;
    const currentEmployeeProfit = profitRecord.employee_profit || 0;

    // حساب النسبة
    const employeePercentage = currentRevenue > 0 
      ? currentEmployeeProfit / currentRevenue 
      : 0;

    let newRevenue = currentRevenue - refundAmount;
    let newProfit = currentProfit - refundAmount;
    let newEmployeeProfit = currentEmployeeProfit - (refundAmount * employeePercentage);

    // إذا أصبح الربح سالباً، تسجيل الخسارة
    if (newRevenue < 0) {
      const lossAmount = Math.abs(newRevenue);
      
      await supabase
        .from('accounting')
        .insert({
          type: 'expense',
          category: 'خسائر إرجاع',
          amount: lossAmount,
          description: `خسارة من إرجاع/استبدال - طلب ${originalOrderId}`,
          reference_type: 'order',
          reference_id: originalOrderId,
          expense_type: 'loss'
        });

      newRevenue = 0;
      newProfit = 0;
      newEmployeeProfit = 0;
    }

    // تحديث سجل الربح
    await supabase
      .from('profits')
      .update({
        total_revenue: Math.max(0, newRevenue),
        profit_amount: Math.max(0, newProfit),
        employee_profit: Math.max(0, newEmployeeProfit),
        updated_at: new Date().toISOString()
      })
      .eq('id', profitRecord.id);

  } catch (error) {
    console.error('Error adjusting original order profit:', error);
    throw error;
  }
};

/**
 * خصم رسوم التوصيل من ربح الموظف
 */
const deductDeliveryFeeFromEmployeeProfit = async (employeeId, deliveryFee, orderId) => {
  try {
    // تسجيل كمصروف في accounting
    await supabase
      .from('accounting')
      .insert({
        type: 'expense',
        category: 'رسوم توصيل استبدال',
        amount: deliveryFee,
        description: `رسوم توصيل استبدال - طلب ${orderId}`,
        reference_type: 'order',
        reference_id: orderId,
        expense_type: 'delivery_fee',
        created_by: employeeId
      });

    // البحث عن آخر سجل ربح للموظف
    const { data: lastProfit, error: fetchError } = await supabase
      .from('profits')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (lastProfit) {
      const newEmployeeProfit = Math.max(0, (lastProfit.employee_profit || 0) - deliveryFee);
      
      await supabase
        .from('profits')
        .update({
          employee_profit: newEmployeeProfit,
          updated_at: new Date().toISOString()
        })
        .eq('id', lastProfit.id);
    }
  } catch (error) {
    console.error('Error deducting delivery fee from employee profit:', error);
    throw error;
  }
};
