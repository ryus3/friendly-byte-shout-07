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
      const waseetPrice = parseInt(String(waseetOrder.price)) || 0; // السعر الشامل من الوسيط
      const deliveryFee = parseInt(String(waseetOrder.delivery_price || localOrder.delivery_fee)) || 0;
      
      // ✅ فصل السعر: منتجات = الشامل - التوصيل
      const productsPriceFromWaseet = waseetPrice - deliveryFee;
      
      // 🎯 حساب السعر الأصلي من order_items (المصدر الموثوق!)
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, unit_price')
        .eq('order_id', localOrder.id);
      
      let originalProductsPrice = 0;
      let priceSource = 'unknown';
      
      if (orderItems && orderItems.length > 0) {
        // ✅ المصدر الأساسي: مجموع order_items
        originalProductsPrice = orderItems.reduce((sum, item) => 
          sum + (item.quantity * item.unit_price), 0
        );
        priceSource = 'order_items';
      } else {
        // Fallback: استخدام final_amount إذا لم توجد order_items
        const originalTotalPrice = parseInt(String(localOrder.final_amount)) || 
                                  parseInt(String(localOrder.total_amount + localOrder.delivery_fee)) || 0;
        originalProductsPrice = originalTotalPrice - (parseInt(String(localOrder.delivery_fee)) || 0);
        priceSource = 'final_amount_fallback';
      }
      
      console.log('🔍 [syncSpecificOrder] حساب التغيير في السعر:', {
        orderId: qrId,
        originalProductsPrice,
        productsPriceFromWaseet,
        deliveryFee,
        priceChange: productsPriceFromWaseet - originalProductsPrice,
        source: priceSource
      });
      
      // ✅ فقط إذا كان هناك تغيير حقيقي في السعر
      if (productsPriceFromWaseet !== originalProductsPrice && 
          waseetPrice > 0 && 
          originalProductsPrice > 0) {
        
        const priceChange = productsPriceFromWaseet - originalProductsPrice;
        
        // تحديث فقط إذا كان التغيير غير صفري
        if (priceChange !== 0) {
          updates.total_amount = productsPriceFromWaseet;
          updates.sales_amount = productsPriceFromWaseet;
          updates.delivery_fee = deliveryFee;
          
          if (priceChange > 0) {
            // زيادة
            updates.discount = 0;
            updates.price_increase = priceChange;
            updates.price_change_type = 'increase';
            console.log(`📈 زيادة في السعر: ${priceChange} د.ع`);
          } else {
            // خصم
            updates.discount = Math.abs(priceChange);
            updates.price_increase = 0;
            updates.price_change_type = 'discount';
            console.log(`📉 خصم: ${Math.abs(priceChange)} د.ع`);
          }
          
          // ✅ تحديث الأرباح
          try {
            const { data: profitRecord } = await supabase
              .from('profits')
              .select('id, total_cost, employee_percentage, profit_amount, employee_profit')
              .eq('order_id', localOrder.id)
              .maybeSingle();
            
            if (profitRecord) {
              const newProfit = productsPriceFromWaseet - profitRecord.total_cost;
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
      } else {
        // لا يوجد تغيير - إعادة تعيين أي قيم خاطئة
        if (localOrder.price_increase > 0 || localOrder.discount > 0) {
          console.log('✅ لا يوجد تغيير في السعر - إعادة تعيين القيم الخاطئة');
          updates.discount = 0;
          updates.price_increase = 0;
          updates.price_change_type = null;
        }
      }
      
      // 🛡️ Validation: منع تعارض الخصم والزيادة
      if (updates.price_increase && updates.discount) {
        console.error('❌ خطأ: لا يمكن وجود زيادة وخصم معاً!', {
          orderId: qrId,
          price_increase: updates.price_increase,
          discount: updates.discount
        });
        delete updates.price_increase;
        delete updates.discount;
        delete updates.price_change_type;
      }
      
      // 🛡️ تنظيف price_change_type إذا كانت القيم صفرية
      if (updates.price_increase === 0 && updates.price_change_type === 'increase') {
        delete updates.price_change_type;
      }
      
      if (updates.discount === 0 && updates.price_change_type === 'discount') {
        delete updates.price_change_type;
      }
    }

    // تحديث رسوم التوصيل إذا تغيرت فقط
    if (waseetOrder.delivery_price) {
      const deliveryPrice = parseInt(String(waseetOrder.delivery_price)) || 0;
      if (deliveryPrice >= 0 && deliveryPrice !== localOrder.delivery_fee) {
        updates.delivery_fee = deliveryPrice;
        
        // ✅ sales_amount يساوي total_amount دائماً (بدون رسوم التوصيل)
        if (updates.total_amount) {
          updates.sales_amount = updates.total_amount;
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

export const syncOrder107647475 = async () => {
  try {
    const token = "7ed481be5a53bf1c12a77fbb9384b9b6";
    const result = await syncSpecificOrder("107647475", token);
    
    if (result && result.success) {
      const updates = result.updates;
      const msg = `✅ تمت مزامنة الطلب 107647475 بنجاح!
      
السعر الأصلي: ${result.local_order.final_amount} د.ع
السعر الحالي: ${updates.total_amount} د.ع
${updates.discount > 0 ? `الخصم: ${updates.discount} د.ع` : ''}
${updates.price_increase > 0 ? `الزيادة: ${updates.price_increase} د.ع` : ''}
رسوم التوصيل: ${updates.delivery_fee} د.ع
المجموع النهائي: ${updates.total_amount + updates.delivery_fee} د.ع`;
      
      alert(msg);
      window.location.reload();
    } else {
      alert('لم تكن هناك حاجة للمزامنة أو حدث خطأ');
    }
  } catch (error) {
    console.error('❌ خطأ في مزامنة الطلب 107647475:', error);
    alert(`خطأ في المزامنة: ${error.message}`);
  }
};

// تجعل الدالة متاحة في النافذة للاستخدام السريع
if (typeof window !== 'undefined') {
  window.syncOrder98713588 = syncOrder98713588;
  window.syncOrder107647475 = syncOrder107647475;
}