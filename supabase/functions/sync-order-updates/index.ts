import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  console.log('🔄 بدء فحص تحديثات طلبات AlWaseet...');

  try {
    // جلب الطلبات النشطة فقط (غير مُنتهية)
    const { data: activeOrders, error } = await supabase
      .from('orders')
      .select('id, tracking_number, delivery_status, final_amount, delivery_fee, created_by, order_type, refund_amount, order_number')
      .eq('delivery_partner', 'alwaseet')
      .not('delivery_status', 'in', ('4', '17', '31', '32'))
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('خطأ في جلب الطلبات:', error);
      throw error;
    }

    console.log(`📦 تم العثور على ${activeOrders?.length || 0} طلب نشط`);

    let updatesCount = 0;
    const changes: any[] = [];

    for (const order of activeOrders || []) {
      try {
        // جلب token المستخدم
        const { data: tokenData } = await supabase
          .from('delivery_partner_tokens')
          .select('token')
          .eq('user_id', order.created_by)
          .eq('partner_name', 'alwaseet')
          .eq('is_active', true)
          .single();

        if (!tokenData) {
          console.log(`⚠️ لم يتم العثور على token للمستخدم ${order.created_by}`);
          continue;
        }

        // جلب بيانات الطلب من AlWaseet
        const response = await fetch(
          `https://api.alwaseet-iq.net/v1/merchant/merchant-orders?token=${tokenData.token}`
        );

        if (!response.ok) {
          console.log(`⚠️ فشل جلب الطلبات من AlWaseet للمستخدم ${order.created_by}`);
          continue;
        }

        const result = await response.json();
        if (!result.status || result.errNum !== 'S000') {
          console.log(`⚠️ استجابة غير صحيحة من AlWaseet`);
          continue;
        }

        const waseetOrder = result.data?.find((o: any) => 
          String(o.qr_id) === String(order.tracking_number) || 
          String(o.id) === String(order.tracking_number)
        );

        if (!waseetOrder) {
          console.log(`⚠️ لم يتم العثور على الطلب ${order.tracking_number} في AlWaseet`);
          continue;
        }

        // ✅ حساب الأسعار بالطريقة الصحيحة الموحدة
        const waseetTotalPrice = Number(waseetOrder.total_price || waseetOrder.price || 0);
        const waseetDeliveryFee = Number(waseetOrder.delivery_price || 0);
        const productsPriceFromWaseet = waseetTotalPrice - waseetDeliveryFee;

        // الأسعار المحلية
        const currentProductsPrice = Number(order.total_amount || 0);
        const currentDeliveryFee = Number(order.delivery_fee || 0);
        const currentFinalAmount = Number(order.final_amount || 0);
        const originalProductsPrice = currentFinalAmount - currentDeliveryFee;

        // مقارنة البيانات
        const currentStatus = String(order.delivery_status || '');
        const newStatus = String(waseetOrder.status_id || '');
        
        const statusChanged = currentStatus !== newStatus;
        const priceChanged = productsPriceFromWaseet !== currentProductsPrice && waseetTotalPrice > 0;
        
        // حساب الفرق
        const priceDiff = originalProductsPrice - productsPriceFromWaseet;

        if (statusChanged || priceChanged) {
          const updates: any = { updated_at: new Date().toISOString() };
          
          if (statusChanged) {
            updates.delivery_status = newStatus;
            if (newStatus === '4') updates.status = 'delivered';
            else if (newStatus === '17') updates.status = 'returned_in_stock';
            else if (['31', '32'].includes(newStatus)) updates.status = 'cancelled';
          }

          // ✅ تحديث السعر بالطريقة الصحيحة الموحدة
          if (priceChanged) {
            updates.total_amount = productsPriceFromWaseet;      // سعر المنتجات
            updates.sales_amount = productsPriceFromWaseet;      // مماثل
            updates.delivery_fee = waseetDeliveryFee;            // رسوم التوصيل
            updates.final_amount = productsPriceFromWaseet + waseetDeliveryFee;  // الشامل
            
            // حساب الزيادة/الخصم
            if (priceDiff > 0) {
              updates.discount = priceDiff;
              updates.price_increase = 0;
              updates.price_change_type = 'discount';
            } else if (priceDiff < 0) {
              updates.price_increase = Math.abs(priceDiff);
              updates.discount = 0;
              updates.price_change_type = 'increase';
            } else {
              updates.price_increase = 0;
              updates.discount = 0;
              updates.price_change_type = null;
            }
            
            // تحديث refund_amount للطلبات المرتجعة
            if (order.order_type === 'return') {
              const calculatedRefund = Math.abs(productsPriceFromWaseet);
              if (calculatedRefund > 0) {
                updates.refund_amount = calculatedRefund;
              }
            }

            // ✅ تحديث الأرباح
            const { data: profitRecord } = await supabase
              .from('profits')
              .select('id, total_cost, employee_percentage')
              .eq('order_id', order.id)
              .maybeSingle();
            
            if (profitRecord) {
              const newProfit = productsPriceFromWaseet - profitRecord.total_cost;
              const employeeShare = (profitRecord.employee_percentage / 100.0) * newProfit;
              
              await supabase
                .from('profits')
                .update({
                  total_revenue: productsPriceFromWaseet + waseetDeliveryFee,
                  profit_amount: newProfit,
                  employee_profit: employeeShare,
                  updated_at: new Date().toISOString()
                })
                .eq('id', profitRecord.id);
              
              console.log(`✅ تحديث الربح للطلب ${order.order_number}: فرق ${priceDiff} د.ع`);
            }

            // ملاحظة للتوثيق
            const currentNotes = order.notes || '';
            const changeType = priceDiff > 0 ? 'خصم' : priceDiff < 0 ? 'زيادة' : 'تعديل';
            updates.notes = `${currentNotes}\n[${new Date().toISOString()}] ${changeType}: من ${currentFinalAmount.toLocaleString()} إلى ${updates.final_amount.toLocaleString()} د.ع`;
          }

          // رسوم التوصيل محدثة بالفعل في قسم السعر

          await supabase
            .from('orders')
            .update(updates)
            .eq('id', order.id);

          updatesCount++;
          changes.push({
            order_id: order.id,
            order_number: order.order_number,
            tracking_number: order.tracking_number,
            status_changed: statusChanged,
            price_changed: priceChanged,
            old_status: currentStatus,
            new_status: newStatus,
            old_price: currentPrice,
            new_price: newPrice
          });

          // إرسال إشعار للمستخدم
          await supabase.from('notifications').insert({
            user_id: order.created_by,
            type: 'alwaseet_sync_update',
            title: 'تحديث من شركة التوصيل',
            message: `الطلب ${order.order_number || order.tracking_number}: ${
              statusChanged ? `الحالة تغيرت إلى ${newStatus}` : ''
            } ${priceChanged ? `السعر تغير إلى ${newPrice.toLocaleString()}` : ''}`,
            data: { 
              order_id: order.id,
              order_number: order.order_number,
              changes: { statusChanged, priceChanged, newStatus, newPrice }
            }
          });
        }
      } catch (orderError: any) {
        console.error(`❌ خطأ في معالجة الطلب ${order.tracking_number}:`, orderError.message);
      }
    }

    

    return new Response(JSON.stringify({
      success: true,
      checked: activeOrders?.length || 0,
      updated: updatesCount,
      changes
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ خطأ في المزامنة:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
