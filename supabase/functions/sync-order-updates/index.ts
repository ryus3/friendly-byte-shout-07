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

  try {
    console.log('🔄 بدء فحص تحديثات طلبات AlWaseet...');
    
    // 1️⃣ جلب جميع التوكنات النشطة
    const { data: allTokens, error: tokensError } = await supabase
      .from('delivery_partner_tokens')
      .select('user_id, token, account_username')
      .eq('partner_name', 'alwaseet')
      .eq('is_active', true);

    if (tokensError || !allTokens || allTokens.length === 0) {
      console.error('❌ فشل جلب التوكنات:', tokensError);
      return new Response(JSON.stringify({ error: 'No active tokens found' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔑 تم العثور على ${allTokens.length} توكن نشط`);

    // 2️⃣ لكل توكن، جلب جميع طلباته من الوسيط
    const allWaseetOrders: any[] = [];
    
    for (const tokenRecord of allTokens) {
      try {
        console.log(`📡 جلب طلبات الحساب: ${tokenRecord.account_username}`);
        
        const response = await fetch(
          `https://api.alwaseet-iq.net/v1/merchant/merchant-orders?token=${tokenRecord.token}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (!response.ok) {
          console.error(`❌ فشل جلب طلبات ${tokenRecord.account_username}: ${response.status}`);
          continue;
        }

        const result = await response.json();
        
        if (result.status && result.data && Array.isArray(result.data)) {
          const ordersWithAccount = result.data.map((order: any) => ({
            ...order,
            _account: tokenRecord.account_username,
            _user_id: tokenRecord.user_id
          }));
          
          allWaseetOrders.push(...ordersWithAccount);
          console.log(`✅ تم جلب ${result.data.length} طلب من ${tokenRecord.account_username}`);
        }
      } catch (tokenError) {
        console.error(`❌ خطأ في جلب طلبات ${tokenRecord.account_username}:`, tokenError);
      }
    }

    console.log(`📦 إجمالي الطلبات من الوسيط: ${allWaseetOrders.length}`);

    // 3️⃣ بناء خريطة للبحث السريع
    const waseetOrdersMap = new Map<string, any>();
    
    for (const wo of allWaseetOrders) {
      // فهرسة حسب id
      if (wo.id) {
        waseetOrdersMap.set(`id_${String(wo.id)}`, wo);
      }
      // فهرسة حسب qr_id
      if (wo.qr_id) {
        waseetOrdersMap.set(`qr_${String(wo.qr_id)}`, wo);
      }
      // فهرسة حسب tracking_number
      if (wo.tracking_number) {
        waseetOrdersMap.set(`track_${String(wo.tracking_number)}`, wo);
      }
    }

    console.log(`🗺️ تم بناء خريطة بـ ${waseetOrdersMap.size} مدخل للبحث`);

    // 4️⃣ جلب الطلبات المحلية النشطة
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, tracking_number, delivery_partner_order_id, qr_id, delivery_status, final_amount, delivery_fee, created_by, order_type, refund_amount, order_number, notes, delivery_account_used, status')
      .eq('delivery_partner', 'alwaseet')
      .not('delivery_status', 'in', '(4,17,31,32)')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (ordersError) {
      console.error('❌ فشل جلب الطلبات المحلية:', ordersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch local orders' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 تم العثور على ${activeOrders?.length || 0} طلب محلي نشط للمزامنة`);

    let updatedCount = 0;
    const changes: any[] = [];

    // 5️⃣ مطابقة وتحديث الطلبات
    for (const localOrder of activeOrders || []) {
      try {
        console.log(`🔍 معالجة الطلب ${localOrder.order_number} (${localOrder.tracking_number})`);
        
        // البحث عن الطلب في خريطة الوسيط
        let waseetOrder = null;
        
        // البحث بـ delivery_partner_order_id أولاً
        if (localOrder.delivery_partner_order_id) {
          waseetOrder = waseetOrdersMap.get(`id_${String(localOrder.delivery_partner_order_id)}`);
        }
        
        // البحث بـ qr_id إذا لم نجد
        if (!waseetOrder && localOrder.qr_id) {
          waseetOrder = waseetOrdersMap.get(`qr_${String(localOrder.qr_id)}`);
        }
        
        // البحث بـ tracking_number إذا لم نجد
        if (!waseetOrder && localOrder.tracking_number) {
          waseetOrder = waseetOrdersMap.get(`track_${String(localOrder.tracking_number)}`);
        }

        if (!waseetOrder) {
          console.log(`⚠️ لم يتم العثور على الطلب ${localOrder.tracking_number} في بيانات الوسيط - تخطي`);
          continue;
        }

        console.log(`✅ تم العثور على الطلب ${localOrder.tracking_number} - الحساب: ${waseetOrder._account} - الحالة: ${waseetOrder.status_id}`);

        // مقارنة البيانات
        const currentStatus = String(localOrder.delivery_status || '');
        const newStatus = String(waseetOrder.status_id || '');
        const currentPrice = Number(localOrder.final_amount || 0);
        const newPrice = Number(waseetOrder.price || 0);

        const statusChanged = currentStatus !== newStatus;
        const priceChanged = currentPrice !== newPrice && newPrice > 0;
        const accountChanged = waseetOrder._account && waseetOrder._account !== localOrder.delivery_account_used;

        // 🔥 دائماً نحدث updated_at حتى بدون تغييرات
        const updates: any = { updated_at: new Date().toISOString() };
        const changesList: string[] = [];

        if (statusChanged || priceChanged || accountChanged) {
          if (statusChanged) {
            updates.delivery_status = newStatus;
            if (newStatus === '4') updates.status = 'delivered';
            else if (newStatus === '17') updates.status = 'returned_in_stock';
            else if (['31', '32'].includes(newStatus)) updates.status = 'cancelled';
            changesList.push(`الحالة: ${currentStatus} → ${newStatus}`);
          }

          if (priceChanged) {
            const priceDifference = newPrice - currentPrice;
            updates.final_amount = newPrice;
            
            const deliveryFee = Number(waseetOrder.delivery_price || localOrder.delivery_fee || 0);
            updates.delivery_fee = deliveryFee;
            updates.sales_amount = newPrice - deliveryFee;
            
            if (localOrder.order_type === 'return') {
              const calculatedRefund = Math.abs(newPrice) - deliveryFee;
              if (calculatedRefund > 0) {
                updates.refund_amount = calculatedRefund;
              }
            }

            // تحديث الأرباح
            const { data: profitRecord } = await supabase
              .from('profits')
              .select('id, total_cost, employee_percentage')
              .eq('order_id', localOrder.id)
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
              
              console.log(`💰 تحديث الأرباح للطلب ${localOrder.order_number}: ${priceDifference} د.ع`);
            }

            const currentNotes = localOrder.notes || '';
            updates.notes = `${currentNotes}\n[${new Date().toISOString()}] السعر تغير من ${currentPrice.toLocaleString()} إلى ${newPrice.toLocaleString()} د.ع`;
            changesList.push(`السعر: ${currentPrice} → ${newPrice} د.ع`);
          }

          if (accountChanged) {
            updates.delivery_account_used = waseetOrder._account;
            changesList.push(`الحساب: ${waseetOrder._account}`);
          }

          // إرسال إشعار للمستخدم
          await supabase.from('notifications').insert({
            user_id: localOrder.created_by,
            type: 'alwaseet_sync_update',
            title: 'تحديث من شركة التوصيل',
            message: `الطلب ${localOrder.order_number || localOrder.tracking_number}: ${changesList.join('، ')}`,
            data: { 
              order_id: localOrder.id,
              order_number: localOrder.order_number,
              changes: { statusChanged, priceChanged, accountChanged, newStatus, newPrice, account: waseetOrder._account }
            }
          });

          updatedCount++;
          changes.push({
            order_id: localOrder.id,
            order_number: localOrder.order_number,
            tracking_number: localOrder.tracking_number,
            account: waseetOrder._account,
            changes: changesList
          });

          console.log(`✅ تم تحديث ${localOrder.tracking_number} (${waseetOrder._account}): ${changesList.join('، ')}`);
        }

        // 🔥 دائماً نحدث الطلب حتى لو لم تتغير البيانات
        await supabase
          .from('orders')
          .update(updates)
          .eq('id', localOrder.id);

        if (!statusChanged && !priceChanged && !accountChanged) {
          console.log(`⏰ تم تحديث وقت ${localOrder.tracking_number} فقط (لا توجد تغييرات)`);
        }

      } catch (orderError: any) {
        console.error(`❌ خطأ في معالجة الطلب ${localOrder.order_number}:`, orderError.message);
      }
    }

    console.log(`✅ انتهت المزامنة: فُحص ${activeOrders?.length || 0} طلب، حُدّث ${updatedCount} طلب بتغييرات`);

    return new Response(JSON.stringify({
      success: true,
      checked: activeOrders?.length || 0,
      updated: updatedCount,
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
