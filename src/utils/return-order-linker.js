import { supabase } from "@/integrations/supabase/client";

/**
 * ربط طلب إرجاع بآخر طلب أصلي مُسلّم
 * @param {string} returnOrderId - معرف طلب الإرجاع
 * @param {string} customerPhone - رقم هاتف الزبون
 * @returns {Promise<{success: boolean, originalOrderId?: string, error?: string}>}
 */
export async function linkReturnToOriginalOrder(returnOrderId, customerPhone) {
  try {
    // تنظيف رقم الهاتف
    const normalizedPhone = customerPhone?.replace(/\D/g, '').slice(-10);
    
    if (!normalizedPhone) {
      return { success: false, error: 'رقم هاتف غير صحيح' };
    }

    // البحث عن آخر طلب مُسلّم لنفس الزبون
    const { data: originalOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, final_amount, delivery_fee, status, created_at')
      .ilike('customer_phone', `%${normalizedPhone}%`)
      .in('status', ['delivered', 'completed'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error('خطأ في جلب الطلبات الأصلية:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!originalOrders || originalOrders.length === 0) {
      return { success: false, error: 'لم يتم العثور على طلب أصلي مُسلّم' };
    }

    // أخذ أحدث طلب مُسلّم
    const originalOrder = originalOrders[0];

    // ربط طلب الإرجاع بالطلب الأصلي
    const { error: updateError } = await supabase
      .from('ai_orders')
      .update({ 
        related_order_id: originalOrder.id,
        original_order_id: originalOrder.id
      })
      .eq('id', returnOrderId);

    if (updateError) {
      console.error('خطأ في ربط طلب الإرجاع:', updateError);
      return { success: false, error: updateError.message };
    }

    return { 
      success: true, 
      originalOrderId: originalOrder.id,
      originalOrderNumber: originalOrder.order_number
    };

  } catch (error) {
    console.error('خطأ في linkReturnToOriginalOrder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ربط طلبَي تبديل ببعضهما (الصادر والوارد)
 * @param {string} outgoingOrderId - معرف الطلب الصادر
 * @param {string} incomingOrderId - معرف الطلب الوارد
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function linkReplacementOrders(outgoingOrderId, incomingOrderId) {
  try {
    const replacementPairId = crypto.randomUUID();

    // ربط كلا الطلبين بنفس replacement_pair_id
    const { error: updateError } = await supabase
      .from('ai_orders')
      .update({ replacement_pair_id: replacementPairId })
      .in('id', [outgoingOrderId, incomingOrderId]);

    if (updateError) {
      console.error('خطأ في ربط طلبات التبديل:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, replacementPairId };

  } catch (error) {
    console.error('خطأ في linkReplacementOrders:', error);
    return { success: false, error: error.message };
  }
}

/**
 * جلب الطلب الأصلي المرتبط بطلب إرجاع
 * @param {string} returnOrderId - معرف طلب الإرجاع
 * @returns {Promise<{success: boolean, originalOrder?: object, error?: string}>}
 */
export async function getOriginalOrderForReturn(returnOrderId) {
  try {
    const { data: returnOrder, error: fetchError } = await supabase
      .from('ai_orders')
      .select('original_order_id, related_order_id')
      .eq('id', returnOrderId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const originalOrderId = returnOrder.original_order_id || returnOrder.related_order_id;
    
    if (!originalOrderId) {
      return { success: false, error: 'لا يوجد طلب أصلي مرتبط' };
    }

    const { data: originalOrder, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', originalOrderId)
      .single();

    if (orderError) {
      return { success: false, error: orderError.message };
    }

    return { success: true, originalOrder };

  } catch (error) {
    console.error('خطأ في getOriginalOrderForReturn:', error);
    return { success: false, error: error.message };
  }
}
