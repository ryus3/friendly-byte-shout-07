import { processReplacementInventory } from './replacement-inventory-handler';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة المخزون التلقائية لطلبات الاستبدال عند تغيير الحالة
 * @param {string} orderId - معرف الطلب
 * @param {number|string} newDeliveryStatus - الحالة الجديدة للتوصيل
 * @returns {Promise<{success: boolean, processed?: number, skipped?: boolean, error?: string}>}
 */
export const handleExchangeStatusChange = async (orderId, newDeliveryStatus) => {
  try {
    // جلب الطلب
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('❌ خطأ في جلب الطلب:', error);
      return { success: false, error: error?.message };
    }

    // التحقق من نوع الطلب
    if (order.order_type !== 'replacement' && order.order_type !== 'exchange') {
      return { success: true, skipped: true };
    }

    // الحالة 21: تسليم للزبون (خصم المنتجات الصادرة)
    if (newDeliveryStatus === '21' || newDeliveryStatus === 21) {
      console.log('🔄 معالجة المنتجات الصادرة للطلب', orderId);
      const result = await processReplacementInventory(
        orderId,
        order.exchange_metadata,
        'outgoing'
      );
      return result;
    }

    // الحالة 17: استلام من الزبون (إضافة المنتجات الواردة)
    if (newDeliveryStatus === '17' || newDeliveryStatus === 17) {
      console.log('🔄 معالجة المنتجات الواردة للطلب', orderId);
      const result = await processReplacementInventory(
        orderId,
        order.exchange_metadata,
        'incoming'
      );
      return result;
    }

    return { success: true, skipped: true };
  } catch (error) {
    console.error('❌ خطأ في معالجة حالة الاستبدال:', error);
    return { success: false, error: error.message };
  }
};
