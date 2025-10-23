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

    // ✅ الحالة 4 أو 21: تسليم للزبون (تحويل الحجز إلى مبيعات فعلية)
    // الحالة 4: في الطريق للزبون | الحالة 21: تم التسليم
    if (newDeliveryStatus === '21' || newDeliveryStatus === 21 || 
        newDeliveryStatus === '4' || newDeliveryStatus === 4) {
      console.log('🔄 تحويل الحجز إلى مبيعات للطلب', orderId);
      
      // ✅ 1. إلغاء الحجز أولاً
      if (order.exchange_metadata?.outgoing_items) {
        for (const item of order.exchange_metadata.outgoing_items) {
          await supabase.rpc('release_variant_stock', {
            p_variant_id: item.variant_id,
            p_quantity: item.quantity || 1,
            p_order_id: orderId
          });
          console.log(`✅ تم إلغاء حجز ${item.product_name}`);
        }
      }
      
      // ✅ 2. خصم من المخزون الفعلي
      const result = await processReplacementInventory(
        orderId,
        order.exchange_metadata,
        'outgoing'
      );
      
      // ✅ 3. معالجة فرق السعر (ربح أو خسارة)
      if (order.exchange_metadata?.priceDifference !== undefined && order.exchange_metadata.priceDifference !== 0) {
        const { handleReplacementFinancials } = await import('./replacement-financial-handler');
        
        await handleReplacementFinancials({
          orderId: order.id,
          originalOrderId: order.original_order_id,
          priceDifference: order.exchange_metadata.priceDifference || order.total_amount,
          deliveryFee: order.delivery_fee || 0,
          employeeId: order.created_by
        });
        
        console.log('✅ تمت معالجة فرق السعر');
      }
      
      console.log('✅ تم تحويل المنتجات الصادرة من "محجوز" إلى "مباع"');
      return result;
    }

    // ✅ الحالة 17: استلام من الزبون (إضافة المنتجات الواردة)
    if (newDeliveryStatus === '17' || newDeliveryStatus === 17) {
      console.log('🔄 إضافة المنتجات الواردة للطلب', orderId);
      const result = await processReplacementInventory(
        orderId,
        order.exchange_metadata,
        'incoming'
      );
      console.log('✅ تم إضافة المنتجات الواردة للمخزون');
      return result;
    }

    return { success: true, skipped: true };
  } catch (error) {
    console.error('❌ خطأ في معالجة حالة الاستبدال:', error);
    return { success: false, error: error.message };
  }
};
