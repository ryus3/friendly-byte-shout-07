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

      // ✅ ai_orders يحتوي بالفعل على external IDs من البوت - لا حاجة للتحويل
      console.log('🔍 [DeliveryOrderHandler] المعرفات من ai_orders:', {
        city_id: aiOrder.city_id,           // external ID مباشرة
        region_id: aiOrder.region_id,       // external ID مباشرة
        city_name: aiOrder.resolved_city_name,
        region_name: aiOrder.resolved_region_name,
        delivery_partner: destination
      });

      // ✅ نقل حرفي 100% من ai_orders إلى شركة التوصيل بدون أي معالجة
      const customerInfo = {
        customer_name: aiOrder.customer_name,                    // نقل مباشر
        customer_phone: aiOrder.customer_phone,                  // نقل مباشر
        customer_address: aiOrder.customer_address || 'لم يُحدد', // نقل حرفي كما هو
        customer_city: aiOrder.resolved_city_name,               // المدينة المحللة
        customer_province: aiOrder.resolved_region_name,         // المنطقة المحللة
        customer_city_id: aiOrder.city_id,                       // external ID مباشرة
        customer_region_id: aiOrder.region_id,                   // external ID مباشرة
        alwaseet_city_id: parseInt(aiOrder.city_id),             // external ID للوسيط
        alwaseet_region_id: parseInt(aiOrder.region_id),         // external ID للوسيط
        notes: aiOrder.notes || '',                              // الملاحظات من الطلب الذكي
        delivery_type: 'توصيل'
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