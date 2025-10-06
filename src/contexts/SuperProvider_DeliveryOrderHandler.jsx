import { useUnifiedOrderCreator } from '@/contexts/AlWaseetUnifiedOrderCreator';
import { supabase } from '@/integrations/supabase/client';
import { useAiOrdersCleanup } from '@/hooks/useAiOrdersCleanup';

// دالة التعامل مع طلبات شركات التوصيل
export const useDeliveryOrderHandler = () => {
  const { createUnifiedOrder } = useUnifiedOrderCreator();
  const { deleteAiOrderWithLink } = useAiOrdersCleanup();

  const handleDeliveryPartnerOrder = async (aiOrder, itemsInput, destination, selectedAccount, accountData = null) => {
    try {
      console.log('📦 معالجة طلب شركة التوصيل:', { destination, selectedAccount });

      // 🎯 الحصول على المعرفات الخارجية لشركة التوصيل المحددة
      const { data: externalCityId } = await supabase.rpc('get_city_external_id', {
        p_city_id: aiOrder.city_id,
        p_delivery_partner: destination.toLowerCase()
      });

      const { data: externalRegionId } = await supabase.rpc('get_region_external_id', {
        p_region_id: aiOrder.region_id,
        p_delivery_partner: destination.toLowerCase()
      });

      console.log('🔍 [DeliveryOrderHandler] المعرفات الخارجية:', {
        unified_city_id: aiOrder.city_id,
        unified_region_id: aiOrder.region_id,
        external_city_id: externalCityId,
        external_region_id: externalRegionId,
        delivery_partner: destination
      });

      // تحويل بيانات الطلب الذكي إلى صيغة createUnifiedOrder
      const customerInfo = {
        customer_name: aiOrder.customer_name,
        customer_phone: aiOrder.customer_phone,
        customer_address: aiOrder.customer_address,
        customer_city: aiOrder.customer_city,
        customer_province: aiOrder.customer_province,
        customer_city_id: aiOrder.city_id,           // المعرف الموحد
        customer_region_id: aiOrder.region_id,       // المعرف الموحد
        alwaseet_city_id: parseInt(externalCityId),  // المعرف الخارجي
        alwaseet_region_id: parseInt(externalRegionId), // المعرف الخارجي
        delivery_type: aiOrder.customer_address ? 'توصيل' : 'محلي'
      };

      // تحويل العناصر إلى صيغة cart
      const cart = itemsInput.map(item => ({
        id: item.product_id || `temp-${Date.now()}-${Math.random()}`,
        product_id: item.product_id,
        variant_id: item.variant_id,
        name: item.product_name || item.name,
        color: item.color,
        size: item.size,
        quantity: Number(item.quantity || 1),
        price: Number(item.unit_price || item.price || 0),
        total: Number(item.quantity || 1) * Number(item.unit_price || item.price || 0)
      }));

      // إنشاء طلب موحد عبر شركة التوصيل مع بيانات الحساب المحدد
      const result = await createUnifiedOrder(customerInfo, cart, 0, {
        id: aiOrder.id,
        source: aiOrder.source || 'ai',
        selectedAccount: selectedAccount,
        accountData: accountData  // تمرير بيانات الحساب مع التوكن
      });

      if (result.success) {
        // ✅ الإصلاح الجذري: ربط الطلب الذكي بدون حذفه للحفاظ على البيانات
        const { linkAiOrderToRealOrder } = await import('@/hooks/useAiOrdersCleanup');
        await linkAiOrderToRealOrder(aiOrder.id, result.orderId);

        // تحديث حالة الطلب الذكي إلى "معالج" بدلاً من حذفه
        await supabase
          .from('ai_orders')
          .update({ 
            status: 'processed',
            processed_at: new Date().toISOString(),
            processed_by: resolveCurrentUserUUID()
          })
          .eq('id', aiOrder.id);

        // تحديث الطلب المنشأ لإضافة معلومات الحساب المستخدم
        if (result.orderId && selectedAccount) {
          await supabase
            .from('orders')
            .update({ delivery_account_used: selectedAccount })
            .eq('id', result.orderId);
        }

        console.log('✅ تم تحويل الطلب الذكي بنجاح - شركة توصيل:', {
          orderId: result.orderId,
          trackingNumber: result.trackingNumber,
          partner: destination,
          account: selectedAccount,
          aiOrderId: aiOrder.id,
          aiOrderStatus: 'processed'
        });

        return {
          success: true,
          orderId: result.orderId,
          trackingNumber: result.trackingNumber,
          method: 'delivery_partner',
          partner: destination,
          account: selectedAccount
        };
      } else {
        throw new Error(result.error || 'فشل في إنشاء الطلب عبر شركة التوصيل');
      }
    } catch (error) {
      console.error('❌ فشل في معالجة طلب شركة التوصيل:', error);
      return {
        success: false,
        error: error.message || 'فشل في إنشاء الطلب عبر شركة التوصيل'
      };
    }
  };

  return { handleDeliveryPartnerOrder };
};