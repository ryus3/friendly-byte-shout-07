import { supabase } from '@/lib/customSupabaseClient';
import devLog from '@/lib/devLogger';

/**
 * معالجة المخزون للطلبات الاستبدالية باستخدام exchange_metadata
 * @param {string} orderId - معرف الطلب
 * @param {Object} exchangeMetadata - بيانات الاستبدال من جدول orders
 * @param {string} processType - نوع المعالجة: 'outgoing' أو 'incoming'
 * @returns {Promise<{success: boolean, processed: number}>}
 */
export const processReplacementInventory = async (orderId, exchangeMetadata, processType = 'outgoing') => {
  try {
    if (!exchangeMetadata) {
      console.error('❌ لا توجد بيانات exchange_metadata للطلب', orderId);
      return { success: false, processed: 0, error: 'No exchange metadata found' };
    }

    let processed = 0;
    const items = processType === 'outgoing' 
      ? exchangeMetadata.outgoing_items 
      : exchangeMetadata.incoming_items;

    if (!items || items.length === 0) {
      devLog.log(`✅ لا توجد منتجات ${processType} للمعالجة`);
      return { success: true, processed: 0 };
    }

    devLog.log(`🔄 معالجة ${items.length} منتج ${processType} للطلب ${orderId}`);

    for (const item of items) {
      const quantityChange = processType === 'outgoing' 
        ? -(item.quantity || 1)  // ✅ خصم للمنتجات الصادرة
        : (item.quantity || 1);   // ✅ إضافة للمنتجات الواردة

      const { error: updateError } = await supabase.rpc(
        'update_variant_stock',
        {
          p_variant_id: item.variant_id,
          p_quantity_change: quantityChange,
          p_reason: `${processType === 'outgoing' ? 'خصم' : 'إضافة'} استبدال - طلب ${orderId}`
        }
      );

      if (updateError) {
        console.error(`❌ خطأ في تحديث المخزون للمنتج ${item.product_name}:`, updateError);
      } else {
        processed++;
        devLog.log(`✅ تم ${processType === 'outgoing' ? 'خصم' : 'إضافة'} ${item.quantity} من ${item.product_name}`);
      }
    }

    return {
      success: true,
      processed
    };
  } catch (error) {
    console.error('❌ خطأ في معالجة المخزون للاستبدال:', error);
    return {
      success: false,
      processed: 0,
      error: error.message
    };
  }
};