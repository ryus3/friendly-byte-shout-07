import { useUnifiedOrderCreator } from '@/contexts/AlWaseetUnifiedOrderCreator';
import { supabase } from '@/integrations/supabase/client';

// دالة التعامل مع طلبات شركات التوصيل
export const useDeliveryOrderHandler = () => {
  const { createUnifiedOrder } = useUnifiedOrderCreator();

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
        // ربط الطلب الذكي بالطلب الحقيقي ثم حذفه بأمان
        try {
          // ربط الطلب الذكي بالطلب الحقيقي للتتبع
          if (result.orderId) {
            await supabase
              .from('ai_orders')
              .update({ related_order_id: result.orderId })
              .eq('id', aiOrder.id);
          }
          
          // حذف الطلب الذكي باستخدام الدالة الآمنة
          const { data: deleteResult, error: delErr } = await supabase.rpc('delete_ai_order_safely', {
            p_ai_order_id: aiOrder.id
          });
          
          if (delErr || !deleteResult) {
            console.warn('⚠️ فشل حذف الطلب الذكي بالدالة الآمنة:', delErr);
            // محاولة حذف مباشرة كـ fallback
            await supabase.from('ai_orders').delete().eq('id', aiOrder.id);
          } else {
            console.log('✅ تم حذف الطلب الذكي بنجاح من معالج التوصيل');
          }
        } catch (linkError) {
          console.error('⚠️ خطأ في ربط/حذف الطلب الذكي:', linkError);
          // محاولة حذف مباشرة في حالة الفشل
          await supabase.from('ai_orders').delete().eq('id', aiOrder.id);
        }

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