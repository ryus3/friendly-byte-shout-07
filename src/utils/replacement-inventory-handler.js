import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة المخزون للطلبات الاستبدالية
 * @param {string} orderId - معرف الطلب
 * @param {string[]} outgoingItemIds - معرفات المنتجات الصادرة للزبون
 * @param {string[]} incomingItemIds - معرفات المنتجات الواردة من الزبون
 * @returns {Promise<{success: boolean, outgoingProcessed: number, incomingProcessed: number}>}
 */
export const processReplacementInventory = async (orderId, outgoingItemIds, incomingItemIds) => {
  try {
    let outgoingProcessed = 0;
    let incomingProcessed = 0;

    // معالجة المنتجات الصادرة (خصم من المخزون)
    if (outgoingItemIds.length > 0) {
      const { data: outgoingItems, error: fetchError } = await supabase
        .from('order_items')
        .select('variant_id, quantity')
        .in('id', outgoingItemIds);

      if (fetchError) throw fetchError;

      for (const item of outgoingItems) {
        const { error: updateError } = await supabase.rpc(
          'update_variant_stock',
          {
            p_variant_id: item.variant_id,
            p_quantity_change: -item.quantity,
            p_reason: `خصم استبدال - طلب ${orderId}`
          }
        );

        if (!updateError) {
          outgoingProcessed++;
        }
      }
    }

    // معالجة المنتجات الواردة (إضافة للمخزون)
    if (incomingItemIds.length > 0) {
      const { data: incomingItems, error: fetchError } = await supabase
        .from('order_items')
        .select('variant_id, quantity')
        .in('id', incomingItemIds);

      if (fetchError) throw fetchError;

      for (const item of incomingItems) {
        const { error: updateError } = await supabase.rpc(
          'update_variant_stock',
          {
            p_variant_id: item.variant_id,
            p_quantity_change: item.quantity,
            p_reason: `إضافة استبدال - طلب ${orderId}`
          }
        );

        if (!updateError) {
          incomingProcessed++;
        }
      }
    }

    return {
      success: true,
      outgoingProcessed,
      incomingProcessed
    };
  } catch (error) {
    console.error('Error processing replacement inventory:', error);
    return {
      success: false,
      outgoingProcessed: 0,
      incomingProcessed: 0,
      error: error.message
    };
  }
};
