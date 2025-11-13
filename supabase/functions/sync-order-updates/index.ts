import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
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

    // التحقق من إعدادات المزامنة
    const { data: scheduleSettings } = await supabase
      .from('auto_sync_schedule_settings')
      .select('*')
      .single();

    const notificationsEnabled = scheduleSettings?.notifications_enabled ?? false;
    console.log(`📢 الإشعارات ${notificationsEnabled ? 'مفعّلة' : 'معطلة'}`);

    // 1️⃣ جلب جميع التوكنات النشطة لكل الشركات
    const { data: allTokens, error: tokensError } = await supabase
      .from('delivery_partner_tokens')
      .select('user_id, token, account_username, partner_name')
      .in('partner_name', ['alwaseet', 'modon'])
      .eq('is_active', true);

    if (tokensError || !allTokens || allTokens.length === 0) {
      console.error('❌ فشل جلب التوكنات:', tokensError);
      return new Response(
        JSON.stringify({ error: 'No active tokens found' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🔑 تم العثور على ${allTokens.length} توكن نشط`);

    // 2️⃣ لكل توكن، جلب جميع طلباته من شركته (الوسيط/مدن)
    const allWaseetOrders: any[] = [];
    for (const tokenRecord of allTokens) {
      try {
        const partnerName = tokenRecord.partner_name || 'alwaseet';
        console.log(`📡 جلب طلبات ${partnerName} للحساب: ${tokenRecord.account_username}`);
        
        // تحديد API URL بناءً على الشركة
        const apiUrl = partnerName === 'modon'
          ? `https://mcht.modon-express.net/v1/merchant/merchant-orders?token=${tokenRecord.token}`
          : `https://api.alwaseet-iq.net/v1/merchant/merchant-orders?token=${tokenRecord.token}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          console.error(`❌ فشل جلب طلبات ${partnerName}/${tokenRecord.account_username}: ${response.status}`);
          continue;
        }

        const result = await response.json();
        if (result.status && result.data && Array.isArray(result.data)) {
          const ordersWithAccount = result.data.map((order: any) => ({
            ...order,
            _account: tokenRecord.account_username,
            _user_id: tokenRecord.user_id,
            _partner: partnerName
          }));
          allWaseetOrders.push(...ordersWithAccount);
          console.log(`✅ تم جلب ${result.data.length} طلب من ${partnerName}/${tokenRecord.account_username}`);
        }
      } catch (tokenError) {
        console.error(`❌ خطأ في جلب طلبات ${tokenRecord.account_username}:`, tokenError);
      }
    }

    console.log(`📦 إجمالي الطلبات من الوسيط: ${allWaseetOrders.length}`);

    // 3️⃣ بناء خريطة للبحث السريع
    const waseetOrdersMap = new Map();
    for (const wo of allWaseetOrders) {
      if (wo.id) waseetOrdersMap.set(`id_${String(wo.id)}`, wo);
      if (wo.qr_id) waseetOrdersMap.set(`qr_${String(wo.qr_id)}`, wo);
      if (wo.tracking_number) waseetOrdersMap.set(`track_${String(wo.tracking_number)}`, wo);
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
      return new Response(
        JSON.stringify({ error: 'Failed to fetch local orders' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📋 تم العثور على ${activeOrders?.length || 0} طلب محلي نشط للمزامنة`);

    let updatedCount = 0;
    const changes: any[] = [];
    const notificationsToInsert: any[] = [];

    // 5️⃣ مطابقة وتحديث الطلبات
    for (const localOrder of activeOrders || []) {
      try {
        console.log(`🔍 معالجة الطلب ${localOrder.order_number} (${localOrder.tracking_number})`);

        // البحث عن الطلب في خريطة الوسيط
        let waseetOrder = null;
        if (localOrder.delivery_partner_order_id) {
          waseetOrder = waseetOrdersMap.get(`id_${String(localOrder.delivery_partner_order_id)}`);
        }
        if (!waseetOrder && localOrder.qr_id) {
          waseetOrder = waseetOrdersMap.get(`qr_${String(localOrder.qr_id)}`);
        }
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

        const updates: any = {
          updated_at: new Date().toISOString()
        };

        const changesList: string[] = [];

        // ✅ منطق صارم جداً: الحالة 4 = delivered حتماً، 17 = returned_in_stock حتماً
        let finalStatus;
        if (localOrder.status === 'delivered' || localOrder.status === 'completed') {
          // حماية مطلقة للطلبات المُسلّمة والمكتملة
          finalStatus = localOrder.status;
        } else if (newStatus === '4') {
          // الحالة 4 = delivered فوراً - لا استثناءات
          finalStatus = 'delivered';
        } else if (newStatus === '17') {
          // الحالة 17 = returned_in_stock فوراً
          finalStatus = 'returned_in_stock';
        } else if (['31', '32'].includes(newStatus)) {
          finalStatus = 'cancelled';
        } else {
          // جميع الحالات الأخرى: استخدام التعريف من alwaseet-statuses
          finalStatus = statusConfig.localStatus || statusConfig.internalStatus || 'delivery';
        }
        
        if (statusChanged || priceChanged || accountChanged) {
          if (statusChanged) {
            updates.delivery_status = newStatus;
            changesList.push(`الحالة: ${currentStatus} → ${newStatus}`);
          } else if (newStatus === '4' && localOrder.status !== 'delivered') {
            // ✅ حتى لو delivery_status لم يتغير، إذا كان '4' و status ليس 'delivered'، صحح
            finalStatus = 'delivered';
            changesList.push(`تصحيح الحالة: ${localOrder.status} → delivered`);
          } else if (newStatus === '17' && localOrder.status !== 'returned_in_stock') {
            finalStatus = 'returned_in_stock';
            changesList.push(`تصحيح الحالة: ${localOrder.status} → returned_in_stock`);
          } else if (['31', '32'].includes(newStatus) && localOrder.status !== 'cancelled') {
            finalStatus = 'cancelled';
            changesList.push(`تصحيح الحالة: ${localOrder.status} → cancelled`);
          }
          
          if (finalStatus !== localOrder.status) {
            updates.status = finalStatus;
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

          // حفظ الإشعار للإدراج لاحقاً (فقط إذا كانت الإشعارات مفعلة)
          if (notificationsEnabled) {
            notificationsToInsert.push({
              user_id: localOrder.created_by,
              type: 'alwaseet_sync_update',
              title: 'تحديث من شركة التوصيل',
              message: `الطلب ${localOrder.order_number || localOrder.tracking_number}: ${changesList.join('، ')}`,
              data: {
                order_id: localOrder.id,
                order_number: localOrder.order_number,
                changes: {
                  statusChanged,
                  priceChanged,
                  accountChanged,
                  newStatus,
                  newPrice,
                  account: waseetOrder._account
                }
              }
            });
          }

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

        // دائماً نحدث الطلب
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

    // إدراج جميع الإشعارات دفعة واحدة (فقط إذا كانت الإشعارات مفعلة)
    if (notificationsEnabled && notificationsToInsert.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (notifError) {
        console.error('❌ فشل إدراج الإشعارات:', notifError);
      } else {
        console.log(`📬 تم إرسال ${notificationsToInsert.length} إشعار`);
      }
    } else if (!notificationsEnabled) {
      console.log('📭 تم تخطي إرسال الإشعارات (معطلة في الإعدادات)');
    }

    // تحديث وقت آخر تشغيل
    await supabase
      .from('auto_sync_schedule_settings')
      .update({ 
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleSettings?.id);

    console.log(`✅ انتهت المزامنة: فُحص ${activeOrders?.length || 0} طلب، حُدّث ${updatedCount} طلب بتغييرات`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: activeOrders?.length || 0,
        updated: updatedCount,
        notifications_sent: notificationsEnabled ? notificationsToInsert.length : 0,
        changes
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('❌ خطأ في المزامنة:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
