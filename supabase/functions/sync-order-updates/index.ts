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
      .select('id, tracking_number, delivery_partner_order_id, delivery_status, final_amount, delivery_fee, created_by, order_type, refund_amount, order_number, notes, delivery_account_used')
      .eq('delivery_partner', 'alwaseet')
      .not('delivery_status', 'in', '(4,17,31,32)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ خطأ في جلب الطلبات:', error);
      throw error;
    }

    console.log(`📦 تم العثور على ${activeOrders?.length || 0} طلب نشط للمزامنة`);

    let updatesCount = 0;
    const changes: any[] = [];

    for (const order of activeOrders || []) {
      try {
        console.log(`🔍 معالجة الطلب ${order.order_number} (${order.tracking_number}) - الحساب: ${order.delivery_account_used || 'غير محدد'}`);
        
        // التحقق من وجود delivery_partner_order_id
        if (!order.delivery_partner_order_id) {
          console.log(`⚠️ الطلب ${order.tracking_number} لا يحتوي على delivery_partner_order_id - تخطي`);
          continue;
        }

        // 1️⃣ البحث عن التوكن المرتبط بالحساب المستخدم في الطلب
        let tokenData = null;

        if (order.delivery_account_used) {
          const { data: accountToken } = await supabase
            .from('delivery_partner_tokens')
            .select('token')
            .eq('user_id', order.created_by)
            .eq('partner_name', 'alwaseet')
            .eq('account_username', order.delivery_account_used)
            .eq('is_active', true)
            .maybeSingle();
          
          tokenData = accountToken;
        }

        // 2️⃣ إذا لم يُعثر على التوكن للحساب المحدد، استخدم الحساب الافتراضي
        if (!tokenData) {
          const { data: defaultToken } = await supabase
            .from('delivery_partner_tokens')
            .select('token')
            .eq('user_id', order.created_by)
            .eq('partner_name', 'alwaseet')
            .eq('is_default', true)
            .eq('is_active', true)
            .maybeSingle();
          
          tokenData = defaultToken;
        }

        // 3️⃣ إذا لم يُعثر على أي توكن، تخطي الطلب
        if (!tokenData) {
          console.log(`❌ لا يوجد token للمستخدم ${order.created_by} - الطلب ${order.tracking_number}`);
          continue;
        }

        console.log(`✅ استخدام token الحساب: ${order.delivery_account_used || 'الافتراضي'}`);

        // ✅ جلب الطلب المحدد مباشرة باستخدام ID الحقيقي - أسرع بـ 10 مرات!
        const response = await fetch(
          `https://api.alwaseet-iq.net/v1/merchant/merchant-orders?token=${tokenData.token}&order_id=${order.delivery_partner_order_id}`
        );

        if (!response.ok) {
          console.log(`❌ فشل جلب الطلب ${order.delivery_partner_order_id} من AlWaseet`);
          continue;
        }

        const result = await response.json();
        if (!result.status || result.errNum !== 'S000') {
          console.log(`❌ استجابة غير صحيحة من AlWaseet للطلب ${order.delivery_partner_order_id}`);
          continue;
        }

        // الطلب المُرجع يكون في result.data (مباشرة أو كمصفوفة)
        const waseetOrder = Array.isArray(result.data) ? result.data[0] : result.data;

        if (!waseetOrder) {
          console.log(`❌ لم يتم العثور على الطلب ${order.delivery_partner_order_id} في AlWaseet`);
          continue;
        }

        console.log(`✅ تم جلب بيانات ${order.tracking_number} - الحالة: ${waseetOrder.status_id}`);

        // مقارنة البيانات
        const currentStatus = String(order.delivery_status || '');
        const newStatus = String(waseetOrder.status_id || '');
        const currentPrice = Number(order.final_amount || 0);
        const newPrice = Number(waseetOrder.price || 0);

        const statusChanged = currentStatus !== newStatus;
        const priceChanged = currentPrice !== newPrice && newPrice > 0;

        // 🔥 دائماً نحدث updated_at حتى بدون تغييرات
        const updates: any = { updated_at: new Date().toISOString() };
        const changesList: string[] = [];

        if (statusChanged || priceChanged) {
          if (statusChanged) {
            updates.delivery_status = newStatus;
            if (newStatus === '4') updates.status = 'delivered';
            else if (newStatus === '17') updates.status = 'returned_in_stock';
            else if (['31', '32'].includes(newStatus)) updates.status = 'cancelled';
            changesList.push(`الحالة: ${currentStatus} → ${newStatus}`);
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
              
              console.log(`💰 تحديث الأرباح للطلب ${order.order_number}: ${priceDifference} د.ع`);
            }

            // ملاحظة للتوثيق
            const currentNotes = order.notes || '';
            updates.notes = `${currentNotes}\n[${new Date().toISOString()}] السعر تغير من ${currentPrice.toLocaleString()} إلى ${newPrice.toLocaleString()} د.ع`;
            changesList.push(`السعر: ${currentPrice} → ${newPrice} د.ع`);
          }

          // تحديث رسوم التوصيل
          if (waseetOrder.delivery_price) {
            updates.delivery_fee = Number(waseetOrder.delivery_price);
          }

          // إرسال إشعار للمستخدم
          await supabase.from('notifications').insert({
            user_id: order.created_by,
            type: 'alwaseet_sync_update',
            title: 'تحديث من شركة التوصيل',
            message: `الطلب ${order.order_number || order.tracking_number}: ${changesList.join('، ')}`,
            data: { 
              order_id: order.id,
              order_number: order.order_number,
              changes: { statusChanged, priceChanged, newStatus, newPrice }
            }
          });

          updatesCount++;
          changes.push({
            order_id: order.id,
            order_number: order.order_number,
            tracking_number: order.tracking_number,
            changes: changesList
          });

          console.log(`✅ تم تحديث ${order.tracking_number}: ${changesList.join('، ')}`);
        }

        // 🔥 دائماً نحدث updated_at حتى لو لم تتغير البيانات
        await supabase
          .from('orders')
          .update(updates)
          .eq('id', order.id);

        if (!statusChanged && !priceChanged) {
          console.log(`⏰ تم تحديث وقت ${order.tracking_number} فقط (لا توجد تغييرات)`);
        }
      } catch (orderError: any) {
        console.error(`❌ خطأ في معالجة الطلب ${order.tracking_number}:`, orderError.message);
      }
    }

    console.log(`✅ انتهت المزامنة: فُحص ${activeOrders?.length || 0} طلب، حُدّث ${updatesCount} طلب بتغييرات`);

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
