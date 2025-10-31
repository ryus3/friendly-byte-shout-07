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
    // جلب الطلبات النشطة فقط (غير مُنتهية) مع delivery_partner_order_id
    const { data: activeOrders, error } = await supabase
      .from('orders')
      .select('id, tracking_number, delivery_partner_order_id, delivery_status, final_amount, delivery_fee, created_by, order_type, refund_amount, order_number, notes')
      .eq('delivery_partner', 'alwaseet')
      .not('delivery_status', 'in', '(4,17,31,32)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('خطأ في جلب الطلبات:', error);
      throw error;
    }

    console.log(`📦 تم العثور على ${activeOrders?.length || 0} طلب نشط`);

    let updatesCount = 0;
    const changes: any[] = [];

    for (const order of activeOrders || []) {
      try {
        // التحقق من وجود delivery_partner_order_id
        if (!order.delivery_partner_order_id) {
          console.log(`⚠️ الطلب ${order.tracking_number} لا يحتوي على delivery_partner_order_id - تخطي`);
          continue;
        }

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

        // ✅ جلب الطلب المحدد مباشرة باستخدام ID الحقيقي - أسرع بـ 10 مرات!
        const response = await fetch(
          `https://api.alwaseet-iq.net/v1/merchant/merchant-orders?token=${tokenData.token}&order_id=${order.delivery_partner_order_id}`
        );

        if (!response.ok) {
          console.log(`⚠️ فشل جلب الطلب ${order.delivery_partner_order_id} من AlWaseet`);
          continue;
        }

        const result = await response.json();
        if (!result.status || result.errNum !== 'S000') {
          console.log(`⚠️ استجابة غير صحيحة من AlWaseet للطلب ${order.delivery_partner_order_id}`);
          continue;
        }

        // الطلب المُرجع يكون في result.data (مباشرة أو كمصفوفة)
        const waseetOrder = Array.isArray(result.data) ? result.data[0] : result.data;

        if (!waseetOrder) {
          console.log(`⚠️ لم يتم العثور على الطلب ${order.delivery_partner_order_id} في AlWaseet`);
          continue;
        }

        // مقارنة البيانات
        const currentStatus = String(order.delivery_status || '');
        const newStatus = String(waseetOrder.status_id || '');
        const currentPrice = Number(order.final_amount || 0);
        const newPrice = Number(waseetOrder.price || 0);

        const statusChanged = currentStatus !== newStatus;
        const priceChanged = currentPrice !== newPrice && newPrice > 0;

        if (statusChanged || priceChanged) {
          const updates: any = { updated_at: new Date().toISOString() };
          
          if (statusChanged) {
            updates.delivery_status = newStatus;
            if (newStatus === '4') updates.status = 'delivered';
            else if (newStatus === '17') updates.status = 'returned_in_stock';
            else if (['31', '32'].includes(newStatus)) updates.status = 'cancelled';
          }

          // ✅ تحديث السعر دائماً إذا تغير
          if (priceChanged) {
            const priceDifference = newPrice - currentPrice;
            
            updates.final_amount = newPrice;
            
            // حساب sales_amount
            const deliveryFee = Number(waseetOrder.delivery_price || order.delivery_fee || 0);
            updates.sales_amount = newPrice - deliveryFee;
            
            // تحديث refund_amount للطلبات المرتجعة
            if (order.order_type === 'return') {
              const calculatedRefund = Math.abs(newPrice) - deliveryFee;
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
              const newProfit = newPrice - deliveryFee - profitRecord.total_cost;
              const employeeShare = (profitRecord.employee_percentage / 100.0) * newProfit;
              
              await supabase
                .from('profits')
                .update({
                  total_revenue: newPrice,
                  profit_amount: newProfit,
                  employee_profit: employeeShare,
                  updated_at: new Date().toISOString()
                })
                .eq('id', profitRecord.id);
              
              console.log(`✅ Profit updated for order ${order.order_number}: ${priceDifference} IQD`);
            }

            // ملاحظة للتوثيق
            const currentNotes = order.notes || '';
            updates.notes = `${currentNotes}\n[${new Date().toISOString()}] السعر تغير من ${currentPrice.toLocaleString()} إلى ${newPrice.toLocaleString()} د.ع`;
          }

          // تحديث رسوم التوصيل
          if (waseetOrder.delivery_price) {
            updates.delivery_fee = Number(waseetOrder.delivery_price);
          }

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
