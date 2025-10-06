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

      // تحويل بيانات الطلب الذكي إلى صيغة createUnifiedOrder
      const customerInfo = {
        customer_name: aiOrder.customer_name,
        customer_phone: aiOrder.customer_phone,
        customer_address: aiOrder.customer_address,
        customer_city: aiOrder.customer_city,
        customer_province: aiOrder.customer_province,
        customer_city_id: aiOrder.city_id,
        customer_region_id: aiOrder.region_id,
        alwaseet_city_id: aiOrder.city_id,
        alwaseet_region_id: aiOrder.region_id,
        delivery_type: aiOrder.customer_address ? 'توصيل' : 'محلي'
      };

      console.log('🔍 [DeliveryOrderHandler] customerInfo المُنشأ:', {
        aiOrder_city_id: aiOrder.city_id,
        aiOrder_region_id: aiOrder.region_id,
        customerInfo_alwaseet_city_id: customerInfo.alwaseet_city_id,
        customerInfo_alwaseet_region_id: customerInfo.alwaseet_region_id,
        customerInfo_customer_city_id: customerInfo.customer_city_id,
        customerInfo_customer_region_id: customerInfo.customer_region_id
      });

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
        // حذف الطلب الذكي بأمان مع الربط
        await deleteAiOrderWithLink(aiOrder.id, result.orderId);

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
          account: selectedAccount
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