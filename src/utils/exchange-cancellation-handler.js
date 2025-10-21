import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة إلغاء طلبات الاستبدال - إلغاء حجز المنتجات
 * @param {string} orderId - معرف الطلب
 * @returns {Promise<{success: boolean, skipped?: boolean, error?: string}>}
 */
export const handleExchangeCancellation = async (orderId) => {
  try {
    // جلب الطلب
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return { success: false, error: error?.message };
    }

    // التحقق من نوع الطلب
    if (order.order_type !== 'replacement' && order.order_type !== 'exchange') {
      return { success: true, skipped: true };
    }

    // ✅ إلغاء حجز المنتجات الصادرة
    if (order.exchange_metadata?.outgoing_items) {
      console.log('🔓 إلغاء حجز المنتجات الصادرة...');
      
      for (const item of order.exchange_metadata.outgoing_items) {
        await supabase.rpc('release_variant_stock', {
          p_variant_id: item.variant_id,
          p_quantity: item.quantity || 1,
          p_order_id: orderId
        });
        
        console.log(`✅ تم إلغاء حجز ${item.quantity} من ${item.product_name}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('❌ خطأ في إلغاء حجز الاستبدال:', error);
    return { success: false, error: error.message };
  }
};
