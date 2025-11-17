import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ✅ تعريفات حالات الوسيط الكاملة (45 حالة: 0-44)
const ALWASEET_STATUS_DEFINITIONS: Record<string, { text: string; localStatus?: string; internalStatus: string; releasesStock: boolean }> = {
  '0': { text: 'معطل او غير فعال', internalStatus: 'pending', releasesStock: false },
  '1': { text: 'فعال ( قيد التجهير)', internalStatus: 'pending', releasesStock: false },
  '2': { text: 'تم الاستلام من قبل المندوب', internalStatus: 'shipped', releasesStock: false },
  '3': { text: 'قيد التوصيل الى الزبون (في عهدة المندوب)', internalStatus: 'delivery', releasesStock: false },
  '4': { text: 'تم التسليم للزبون', localStatus: 'delivered', internalStatus: 'delivered', releasesStock: true },
  '5': { text: 'في موقع فرز بغداد', internalStatus: 'delivery', releasesStock: false },
  '6': { text: 'في مكتب', internalStatus: 'delivery', releasesStock: false },
  '7': { text: 'في الطريق الى مكتب المحافظة', internalStatus: 'shipped', releasesStock: false },
  '8': { text: 'في مخزن بغداد', internalStatus: 'shipped', releasesStock: false },
  '9': { text: 'ملغى من قبل التاجر', localStatus: 'cancelled', internalStatus: 'cancelled', releasesStock: true },
  '10': { text: 'راجع ( العنوان ناقص )', internalStatus: 'delivery', releasesStock: false },
  '11': { text: 'راجع ( الهاتف مقفل )', internalStatus: 'delivery', releasesStock: false },
  '12': { text: 'راجع ( تعطل )', internalStatus: 'delivery', releasesStock: false },
  '13': { text: 'راجع ( تأجيل )', internalStatus: 'delivery', releasesStock: false },
  '14': { text: 'راجع ( الاستلام من الفرع)', internalStatus: 'delivery', releasesStock: false },
  '15': { text: 'راجع (عنوان خطأ)', internalStatus: 'delivery', releasesStock: false },
  '16': { text: 'راجع ( رفض )', internalStatus: 'delivery', releasesStock: false },
  '17': { text: 'تم الارجاع الى التاجر', localStatus: 'returned_in_stock', internalStatus: 'returned_in_stock', releasesStock: true },
  '18': { text: 'راجع ( عنوان غير صحيح )', internalStatus: 'delivery', releasesStock: false },
  '19': { text: 'راجع ( يرغب بتغير المنطقة )', internalStatus: 'delivery', releasesStock: false },
  '20': { text: 'راجع ( طلب فحص من قبل التاجر)', internalStatus: 'delivery', releasesStock: false },
  '21': { text: 'تم التسليم للزبون واستلام منة الاسترجاع', localStatus: 'delivered', internalStatus: 'delivered', releasesStock: false },
  '22': { text: 'راجع ( غير موجود )', internalStatus: 'delivery', releasesStock: false },
  '23': { text: 'ارسال الى مخزن الارجاعات', internalStatus: 'delivery', releasesStock: false },
  '24': { text: 'راجع ( هاتف خطاء )', internalStatus: 'delivery', releasesStock: false },
  '25': { text: 'راجع ( لتغير الاسم )', internalStatus: 'delivery', releasesStock: false },
  '26': { text: 'راجع ( لتغير رقم الهاتف )', internalStatus: 'delivery', releasesStock: false },
  '27': { text: 'راجع ( التاجر قام بإضافة العنوان خطأ )', internalStatus: 'delivery', releasesStock: false },
  '28': { text: 'راجع ( الزبون طلب ان يكون استلام من التاجر او من فرع الوسيط )', internalStatus: 'delivery', releasesStock: false },
  '29': { text: 'راجع ( لتنازل )', internalStatus: 'delivery', releasesStock: false },
  '30': { text: 'راجع ( لتحويل الراجع )', internalStatus: 'delivery', releasesStock: false },
  '31': { text: 'الغاء الطلب', localStatus: 'cancelled', internalStatus: 'cancelled', releasesStock: true },
  '32': { text: 'رفض الطلب', localStatus: 'cancelled', internalStatus: 'cancelled', releasesStock: true },
  '33': { text: 'راجع ( هاتف لا يرد )', internalStatus: 'delivery', releasesStock: false },
  '34': { text: 'راجع ( هاتف خارج الخدمة )', internalStatus: 'delivery', releasesStock: false },
  '35': { text: 'راجع ( لتغير نوع الدفع )', internalStatus: 'delivery', releasesStock: false },
  '36': { text: 'راجع ( رفض السعر )', internalStatus: 'delivery', releasesStock: false },
  '37': { text: 'راجع ( لعدم الحاجة )', internalStatus: 'delivery', releasesStock: false },
  '38': { text: 'راجع ( الاستلام من فرع الوسيط )', internalStatus: 'delivery', releasesStock: false },
  '39': { text: 'راجع ( عنوان جديد )', internalStatus: 'delivery', releasesStock: false },
  '40': { text: 'راجع ( رفض الفحص )', internalStatus: 'delivery', releasesStock: false },
  '41': { text: 'راجع ( لتغير التفاصيل )', internalStatus: 'delivery', releasesStock: false },
  '42': { text: 'راجع ( رفض رسوم التوصيل )', internalStatus: 'delivery', releasesStock: false },
  '43': { text: 'راجع ( رفض جزئي )', internalStatus: 'delivery', releasesStock: false },
  '44': { text: 'راجع ( أخرى )', internalStatus: 'delivery', releasesStock: false },
};

function getStatusConfig(statusId: string | number) {
  const id = String(statusId);
  return ALWASEET_STATUS_DEFINITIONS[id] || { text: 'حالة غير معروفة', internalStatus: 'delivery', releasesStock: false };
}

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
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result?.status && result?.data) {
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
      .not('delivery_status', 'in', '(17,31,32)')
      .not('status', 'in', '(completed,returned_in_stock)')
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
          console.log(`⏭️ الطلب ${localOrder.tracking_number} غير موجود في نتائج الوسيط`);
          continue;
        }

        const currentStatus = String(localOrder.delivery_status || '');
        const newStatus = String(waseetOrder.status_id || waseetOrder.state_id || waseetOrder.status || '');

        const updates: any = {};
        const changesList: string[] = [];
        let statusChanged = false;
        let priceChanged = false;
        let accountChanged = false;

        // Compare status
        const statusChangedCheck = currentStatus !== newStatus;

        if (statusChangedCheck) {
          const statusConfig = getStatusConfig(newStatus);
          const finalStatus = statusConfig.localStatus || statusConfig.internalStatus || 'delivery';
          
          console.log(`🔄 تحديث ${localOrder.tracking_number}:`, {
            delivery_status: `${currentStatus} → ${newStatus} (${statusConfig.text})`,
            status: `${localOrder.status} → ${finalStatus}`
          });
          
          updates.delivery_status = newStatus;
          updates.status = finalStatus;
          statusChanged = true;
          changesList.push(`الحالة: ${currentStatus} → ${newStatus} (${statusConfig.text})`);
        }

        // ✅ حماية طلبات التسليم الجزئي من تحديث السعر الخاطئ
        const { data: partialHistory } = await supabase
          .from('partial_delivery_history')
          .select('delivered_revenue')
          .eq('order_id', localOrder.id)
          .maybeSingle();

        const isPartialDelivery = !!partialHistory;

        // Compare prices
        const currentPrice = parseInt(String(localOrder.final_amount || 0));
        const newPrice = parseInt(String(waseetOrder.price || 0));

        // ✅ لا تحدث السعر إذا كان partial_delivery - احترم delivered_revenue
        if (newPrice > 0 && currentPrice !== newPrice && !isPartialDelivery) {
          updates.final_amount = newPrice;
          priceChanged = true;

          // إعادة حساب الأرباح
          const { data: profitRecord } = await supabase
            .from('order_employee_profits')
            .select('*')
            .eq('order_id', localOrder.id)
            .maybeSingle();

          if (profitRecord) {
            const priceDifference = newPrice - currentPrice;
            const employeeShare = Math.floor(priceDifference * 0.5);

            await supabase
              .from('order_employee_profits')
              .update({
                order_total_amount: newPrice,
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

        // Compare account
        if (waseetOrder._account && localOrder.delivery_account_used !== waseetOrder._account) {
          accountChanged = true;
          updates.delivery_account_used = waseetOrder._account;
          changesList.push(`الحساب: ${waseetOrder._account}`);
        }

        if (statusChanged || priceChanged || accountChanged) {
          // حفظ الإشعار للإدراج لاحقاً (فقط إذا كانت الإشعارات مفعلة)
          if (notificationsEnabled) {
            notificationsToInsert.push({
              user_id: localOrder.created_by,
              type: 'alwaseet_sync_update',
              title: 'تحديث من شركة التوصيل',
              message: `الطلب ${localOrder.tracking_number || localOrder.order_number}: ${changesList.join('، ')}`,
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
        console.error('❌ خطأ في إدراج الإشعارات:', notifError);
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
