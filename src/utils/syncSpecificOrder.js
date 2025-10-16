// أداة سريعة لمزامنة طلب محدد مع الوسيط
import { supabase } from '@/integrations/supabase/client';
import * as AlWaseetAPI from '@/lib/alwaseet-api';

export const syncSpecificOrder = async (qrId, token) => {
  try {
    // جلب الطلب من الوسيط
    const waseetOrder = await AlWaseetAPI.getOrderByQR(token, qrId);
    if (!waseetOrder) {
      return null;
    }

    // تحديد الحالة المحلية الصحيحة مع أولوية للمعرفات الرقمية
    const statusId = waseetOrder.status_id || waseetOrder.state_id;
    let standardizedDeliveryStatus;
    
    // أولوية للمعرف الرقمي إن وجد
    if (statusId) {
      standardizedDeliveryStatus = String(statusId);
    } else if (waseetOrder.status_text === 'تم التسليم للزبون') {
      standardizedDeliveryStatus = '4';
    } else if (waseetOrder.status_text === 'تم الارجاع الى التاجر') {
      standardizedDeliveryStatus = '17';
    } else {
      standardizedDeliveryStatus = waseetOrder.status || waseetOrder.status_text || waseetOrder.status_name || '';
    }
    
    // تحديد الحالة المحلية بناءً على delivery_status المعياري
    let correctLocalStatus = 'pending';
    if (standardizedDeliveryStatus === '4') {
      correctLocalStatus = 'delivered';
    } else if (standardizedDeliveryStatus === '17') {
      correctLocalStatus = 'returned_in_stock';
    } else if (['31', '32'].includes(standardizedDeliveryStatus)) {
      correctLocalStatus = 'cancelled';
    } else if (['2', '3'].includes(standardizedDeliveryStatus)) {
      correctLocalStatus = 'shipped';
    } else if (['14', '22', '23', '24', '42', '44'].includes(standardizedDeliveryStatus)) {
      correctLocalStatus = 'delivery';
    }

    // جلب الطلب المحلي
    const { data: localOrder, error: localErr } = await supabase
      .from('orders')
      .select('*')
      .eq('tracking_number', qrId)
      .maybeSingle();

    if (localErr) {
      console.error('❌ خطأ في جلب الطلب المحلي:', localErr);
      return null;
    }

    if (!localOrder) {
      console.warn(`❌ لم يتم العثور على الطلب ${qrId} محلياً`);
      return null;
    }

    // تحضير التحديثات مع delivery_status المعياري
    const updates = {
      status: correctLocalStatus,
      delivery_status: standardizedDeliveryStatus,
      delivery_partner_order_id: String(waseetOrder.id),
      updated_at: new Date().toISOString()
    };

    // ✅ تحديث السعر إذا تغير من الوسيط
    if (waseetOrder.price) {
      const waseetPrice = parseInt(String(waseetOrder.price)) || 0;
      const currentPrice = parseInt(String(localOrder.final_amount || localOrder.total_amount)) || 0;
      
      if (waseetPrice !== currentPrice && waseetPrice > 0) {
        const priceDifference = waseetPrice - currentPrice;
        
        updates.final_amount = waseetPrice;
        updates.total_amount = waseetPrice;
        
        // حساب sales_amount (السعر - رسوم التوصيل)
        const deliveryFee = parseInt(String(waseetOrder.delivery_price || localOrder.delivery_fee)) || 0;
        updates.sales_amount = waseetPrice - deliveryFee;
        
        // ✅ تحديث الأرباح
        try {
          const { data: profitRecord } = await supabase
            .from('profits')
            .select('id, total_cost, employee_percentage, profit_amount, employee_profit')
            .eq('order_id', localOrder.id)
            .maybeSingle();
          
          if (profitRecord) {
            const newProfit = waseetPrice - deliveryFee - profitRecord.total_cost;
            const employeeShare = (profitRecord.employee_percentage / 100.0) * newProfit;
            
            await supabase
              .from('profits')
              .update({
                total_revenue: waseetPrice,
                profit_amount: newProfit,
                employee_profit: employeeShare,
                updated_at: new Date().toISOString()
              })
              .eq('id', profitRecord.id);
          }
        } catch (profitError) {
          console.error('❌ خطأ في تحديث الأرباح:', profitError);
        }
      }
    }

    // تحديث رسوم التوصيل
    if (waseetOrder.delivery_price) {
      const deliveryPrice = parseInt(String(waseetOrder.delivery_price)) || 0;
      if (deliveryPrice >= 0) {
        updates.delivery_fee = deliveryPrice;
        
        // إعادة حساب sales_amount إذا تم تحديث رسوم التوصيل
        if (updates.final_amount) {
          updates.sales_amount = updates.final_amount - deliveryPrice;
        }
      }
    }

    // تحديث حالة استلام الإيصال
    if (waseetOrder.deliver_confirmed_fin === 1 || correctLocalStatus === 'delivered') {
      updates.receipt_received = true;
    }

    // تطبيق التحديثات
    const { error: updateErr } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', localOrder.id);

    if (updateErr) {
      console.error('❌ خطأ في تحديث الطلب:', updateErr);
      return null;
    }

    
    return {
      success: true,
      needs_update: localOrder.status !== correctLocalStatus || localOrder.delivery_status !== standardizedDeliveryStatus,
      updates,
      waseet_order: waseetOrder,
      local_order: { ...localOrder, ...updates }
    };

  } catch (error) {
    console.error(`❌ خطأ في مزامنة الطلب ${qrId}:`, error);
    throw error;
  }
};

export const syncOrder98713588 = async () => {
  try {
    const token = "7ed481be5a53bf1c12a77fbb9384b9b6";
    const result = await syncSpecificOrder("98713588", token);
    
    if (result && result.success) {
      alert(`تمت مزامنة الطلب 98713588 بنجاح!\nالحالة الجديدة: ${result.updates.status}\nحالة الوسيط: ${result.updates.delivery_status}`);
      window.location.reload();
    } else {
      alert('لم تكن هناك حاجة للمزامنة أو حدث خطأ');
    }
  } catch (error) {
    console.error('❌ خطأ في مزامنة الطلب 98713588:', error);
    alert(`خطأ في المزامنة: ${error.message}`);
  }
};

// تجعل الدالة متاحة في النافذة للاستخدام السريع
if (typeof window !== 'undefined') {
  window.syncOrder98713588 = syncOrder98713588;
}