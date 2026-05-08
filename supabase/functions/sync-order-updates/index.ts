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
  '21': { text: 'تم التسليم للزبون واستلام منة الاسترجاع', localStatus: 'partial_delivery', internalStatus: 'partial_delivery', releasesStock: false },
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

  // ✅ قراءة scope من body (لمنع المدير من مزامنة طلبات الموظفين عبر زر الهيدر)
  let scopeUserId: string | null = null;
  let scopeMode: 'own' | 'managed' | 'global' = 'global';
  let invokedSource = 'cron';
  try {
    if (req.method !== 'GET') {
      const body = await req.clone().json().catch(() => ({}));
      scopeUserId = body?.scope_user_id || null;
      const m = String(body?.scope_mode || '').toLowerCase();
      if (m === 'own' || m === 'managed' || m === 'global') scopeMode = m as any;
      invokedSource = String(body?.source || 'cron');
    }
  } catch { /* ignore */ }

  // ✅ تعامل صارم: زر الهيدر/فتح الصفحة لا يجوز أن يصبح global
  if (scopeUserId && scopeMode === 'global') scopeMode = 'own';

  console.log(`🎯 scope: mode=${scopeMode} user=${scopeUserId || 'ALL'} source=${invokedSource}`);

  try {
    console.log('🔄 بدء فحص تحديثات طلبات AlWaseet...');

    // التحقق من إعدادات المزامنة
    const { data: scheduleSettings } = await supabase
      .from('auto_sync_schedule_settings')
      .select('*')
      .single();

    const notificationsEnabled = scheduleSettings?.notifications_enabled ?? false;
    console.log(`📢 الإشعارات ${notificationsEnabled ? 'مفعّلة' : 'معطلة'}`);

    // ✅ حضّر قائمة المستخدمين المسموح بهم لمزامنة طلباتهم
    let allowedUserIds: string[] | null = null; // null = الجميع (cron فقط)
    if (scopeUserId) {
      if (scopeMode === 'managed') {
        const { data: subs } = await supabase
          .from('employee_supervisors')
          .select('employee_id')
          .eq('supervisor_id', scopeUserId)
          .eq('is_active', true);
        allowedUserIds = Array.from(new Set([scopeUserId, ...((subs || []).map((s: any) => s.employee_id))]));
      } else {
        // own
        allowedUserIds = [scopeUserId];
      }
      console.log(`🔒 الفلترة: ${allowedUserIds.length} مستخدم مسموح`);
    }

    // 0️⃣ قراءة الشركاء النشطين ديناميكياً من السجل (يدعم أي شركة جديدة تلقائياً)
    const { data: registry } = await supabase
      .from('delivery_partners_registry')
      .select('partner_key, base_url')
      .eq('is_active', true);
    const partnerBaseMap: Record<string, string> = {};
    (registry || []).forEach((r: any) => {
      if (r?.partner_key && r?.base_url) partnerBaseMap[r.partner_key] = r.base_url;
    });
    // ضمان وجود الافتراضيات حتى لو سجل التسجيل فارغ
    if (!partnerBaseMap['alwaseet']) partnerBaseMap['alwaseet'] = 'https://api.alwaseet-iq.net/v1/merchant';
    if (!partnerBaseMap['modon']) partnerBaseMap['modon'] = 'https://mcht.modon-express.net/v1/merchant';
    const activePartnerKeys = Object.keys(partnerBaseMap);
    console.log(`🌐 الشركاء النشطون: ${activePartnerKeys.join(', ')}`);

    // 1️⃣ جلب جميع التوكنات النشطة لكل الشركات النشطة في السجل
    const { data: allTokens, error: tokensError } = await supabase
      .from('delivery_partner_tokens')
      .select('user_id, token, account_username, partner_name')
      .in('partner_name', activePartnerKeys)
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
    // ✅ نتتبع أي (شريك + حساب) جلب رداً ناجحاً، لتجنب احتساب الطلب كمحذوف بسبب فشل API
    const successfulFetches = new Set<string>();
    for (const tokenRecord of allTokens) {
      const partnerName = tokenRecord.partner_name || 'alwaseet';
      try {
        console.log(`📡 جلب طلبات ${partnerName} للحساب: ${tokenRecord.account_username}`);

        // ✅ كلا الشريكين عبر Static IP proxy لتفادي حجب Cloudflare WAF
        let baseUrl: string;
        if (partnerName === 'modon') {
          baseUrl = 'https://api.ryusbrand.com/modon/v1/merchant';
        } else if (partnerName === 'alwaseet') {
          baseUrl = 'https://api.ryusbrand.com/alwaseet/v1/merchant';
        } else {
          baseUrl = partnerBaseMap[partnerName] || 'https://api.alwaseet-iq.net/v1/merchant';
        }
        const apiUrl = `${baseUrl.replace(/\/$/, '')}/merchant-orders?token=${tokenRecord.token}`;

        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          console.error(`❌ HTTP ${response.status} من ${partnerName}/${tokenRecord.account_username}`);
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        // ✅ نجاح فقط إذا الرد منظم (status=true)، حتى لو كانت data فارغة
        if (result?.status === true) {
          const dataArr = Array.isArray(result?.data) ? result.data : [];
          const ordersWithAccount = dataArr.map((order: any) => ({
            ...order,
            _account: tokenRecord.account_username,
            _user_id: tokenRecord.user_id,
            _partner: partnerName
          }));
          allWaseetOrders.push(...ordersWithAccount);
          successfulFetches.add(`${partnerName}:${tokenRecord.account_username}`);
          console.log(`✅ تم جلب ${dataArr.length} طلب من ${partnerName}/${tokenRecord.account_username}`);
        } else {
          console.warn(`⚠️ رد غير ناجح من ${partnerName}/${tokenRecord.account_username}: errNum=${result?.errNum} msg=${result?.msg || ''}`);
        }
      } catch (tokenError: any) {
        console.error(`❌ خطأ في جلب طلبات ${partnerName}/${tokenRecord.account_username}: ${tokenError?.message || tokenError}`);
      }
    }

    // ✅ Heartbeat: تحديث last_sync_at لكل التوكنات النشطة (نجحت أم فشلت)
    // — للناجحة: علامة على آخر نجاح فعلي.
    // — للفاشلة: المستخدم يرى أن النظام يحاول، لا يجلس صامتاً.
    try {
      const nowSyncIso = new Date().toISOString();
      for (const tokenRecord of allTokens) {
        const partnerName = tokenRecord.partner_name || 'alwaseet';
        await supabase
          .from('delivery_partner_tokens')
          .update({ last_sync_at: nowSyncIso })
          .eq('user_id', tokenRecord.user_id)
          .eq('partner_name', partnerName)
          .eq('account_username', tokenRecord.account_username);
      }
    } catch (tokenStampErr) {
      console.warn('⚠️ تعذر تحديث last_sync_at للتوكنات:', tokenStampErr);
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

    // 4️⃣ جلب الطلبات المحلية النشطة من كل الشركاء النشطين
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, tracking_number, delivery_partner_order_id, qr_id, delivery_status, final_amount, delivery_fee, created_by, order_type, refund_amount, order_number, notes, delivery_account_used, status, delivery_partner, customer_city, customer_province, customer_address, partner_missed_count, receipt_received')
      .in('delivery_partner', activePartnerKeys)
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
        console.log(`🔍 معالجة الطلب ${localOrder.order_number} (${localOrder.tracking_number}) - الشركة: ${localOrder.delivery_partner}`);

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
          // ✅ كشف الحذف من قبل الشريك بأمان (2-strike):
          //    نُزيد العداد فقط إذا كان الجلب من شريك+حساب الطلب نفسه ناجحاً.
          //    هذا يمنع احتساب فشل API كحذف.
          const localAccount = (localOrder.delivery_account_used || '').trim();
          const fetchKey = `${localOrder.delivery_partner}:${localAccount}`;
          // إن لم يكن لدينا حساب محدد، نتحقق إن كان أي حساب من نفس الشريك نجح
          const partnerHadSuccess = localAccount
            ? successfulFetches.has(fetchKey)
            : Array.from(successfulFetches).some(k => k.startsWith(`${localOrder.delivery_partner}:`));

          if (partnerHadSuccess) {
            const newCount = ((localOrder as any).partner_missed_count || 0) + 1;
            console.log(`🚨 الطلب ${localOrder.tracking_number} غير موجود لدى ${localOrder.delivery_partner} (مرة ${newCount}/2)`);

            if (newCount >= 2) {
              // 2-strike: نتأكد من غياب أي ارتباط مالي قبل اتخاذ القرار
              //   - بدون إيصال مستلم وبدون فاتورة وبدون أرباح موظف ⇒ حذف فعلي (الـ trigger يحرر المخزون)
              //   - وإلا ⇒ حذف ناعم (ملغى من الشريك) للحفاظ على السجل المحاسبي
              let canHardDelete = true;
              let hardDeleteReason = '';

              try {
                // 1) إيصال مستلم؟
                if ((localOrder as any).receipt_received === true) {
                  canHardDelete = false;
                  hardDeleteReason = 'receipt_received=true';
                }

                // 2) مرتبط بفاتورة شريك؟
                if (canHardDelete) {
                  const { data: linkedInv } = await supabase
                    .from('delivery_invoice_orders')
                    .select('id')
                    .eq('order_id', localOrder.id)
                    .limit(1);
                  if (linkedInv && linkedInv.length > 0) {
                    canHardDelete = false;
                    hardDeleteReason = 'linked_invoice';
                  }
                }

                // 3) أرباح موظف مدفوعة؟
                if (canHardDelete) {
                  const { data: paidProfits } = await supabase
                    .from('profits')
                    .select('id, status')
                    .eq('order_id', localOrder.id)
                    .in('status', ['settled', 'invoice_received'])
                    .limit(1);
                  if (paidProfits && paidProfits.length > 0) {
                    canHardDelete = false;
                    hardDeleteReason = 'profits_paid';
                  }
                }
              } catch (checkErr) {
                console.error(`⚠️ فشل فحص الارتباطات للطلب ${localOrder.tracking_number}:`, checkErr);
                canHardDelete = false;
                hardDeleteReason = 'check_error';
              }

              if (canHardDelete) {
                // 🗑️ حذف فعلي — الـ trigger before delete يُحرر المخزون تلقائياً
                console.log(`🗑️ حذف فعلي للطلب ${localOrder.tracking_number} (محذوف من ${localOrder.delivery_partner})`);
                const { error: delErr } = await supabase
                  .from('orders')
                  .delete()
                  .eq('id', localOrder.id);
                if (delErr) {
                  console.error(`❌ فشل الحذف الفعلي للطلب ${localOrder.tracking_number}:`, delErr);
                } else {
                  updatedCount++;
                  changes.push({
                    order_id: localOrder.id,
                    order_number: localOrder.order_number,
                    tracking_number: localOrder.tracking_number,
                    changes: [`حذف فعلي — محذوف من ${localOrder.delivery_partner} (2-strike)`]
                  });
                  if (notificationsEnabled) {
                    notificationsToInsert.push({
                      user_id: localOrder.created_by,
                      type: 'alwaseet_status_change',
                      title: `تم حذف الطلب من ${localOrder.delivery_partner === 'modon' ? 'مدن' : 'الوسيط'}`,
                      message: `الطلب ${localOrder.tracking_number} لم يعد موجوداً لدى شركة التوصيل وتم حذفه من النظام تلقائياً`,
                      priority: 'high',
                      data: {
                        order_id: localOrder.id,
                        order_number: localOrder.order_number,
                        tracking_number: localOrder.tracking_number,
                        action: 'hard_deleted'
                      }
                    });
                  }
                }
              } else {
                // 💼 حذف ناعم — للحفاظ على السجل المالي
                console.log(`📦 حذف ناعم للطلب ${localOrder.tracking_number} (سبب الحماية: ${hardDeleteReason})`);
                const updateData: any = {
                  delivery_status: '32',
                  status: 'cancelled',
                  partner_missed_count: newCount,
                  updated_at: new Date().toISOString(),
                  notes: `${localOrder.notes || ''}\n[${new Date().toISOString()}] تم رصد حذف الطلب من ${localOrder.delivery_partner} (2-strike) — حذف ناعم: ${hardDeleteReason}`
                };
                const { error: cancelErr } = await supabase
                  .from('orders')
                  .update(updateData)
                  .eq('id', localOrder.id);
                if (cancelErr) {
                  console.error(`❌ فشل تعليم الطلب ${localOrder.tracking_number} كمحذوف:`, cancelErr);
                } else {
                  updatedCount++;
                  changes.push({
                    order_id: localOrder.id,
                    order_number: localOrder.order_number,
                    tracking_number: localOrder.tracking_number,
                    changes: [`ملغى من ${localOrder.delivery_partner} (محمي محاسبياً: ${hardDeleteReason})`]
                  });
                  if (notificationsEnabled) {
                    notificationsToInsert.push({
                      user_id: localOrder.created_by,
                      type: 'alwaseet_status_change',
                      title: `تم حذف الطلب من ${localOrder.delivery_partner === 'modon' ? 'مدن' : 'الوسيط'}`,
                      message: `الطلب ${localOrder.tracking_number} لم يعد موجوداً لدى شركة التوصيل`,
                      priority: 'high',
                      data: {
                        order_id: localOrder.id,
                        order_number: localOrder.order_number,
                        tracking_number: localOrder.tracking_number,
                        delivery_status: '32'
                      }
                    });
                  }
                }
              }
            } else {
              // strike 1: زيادة العداد فقط
              await supabase
                .from('orders')
                .update({ partner_missed_count: newCount })
                .eq('id', localOrder.id);
            }
          } else {
            console.log(`⏭️ الطلب ${localOrder.tracking_number} غير موجود لكن لم يصل رد ناجح من ${localOrder.delivery_partner} - تخطي بأمان`);
          }
          continue;
        }

        // ✅ إعادة تصفير العداد عند ظهور الطلب مجدداً
        if ((localOrder as any).partner_missed_count > 0) {
          await supabase
            .from('orders')
            .update({ partner_missed_count: 0 })
            .eq('id', localOrder.id);
        }

        // ✅ CRITICAL: تحقق من أن الطلب المُطابق ينتمي لنفس شركة التوصيل
        if (waseetOrder._partner !== localOrder.delivery_partner) {
          console.warn(`⚠️ تم تجاهل الطلب ${localOrder.tracking_number} - تداخل بين الشركات! (محلي: ${localOrder.delivery_partner}, مزامن: ${waseetOrder._partner})`);
          continue;
        }

        const currentStatus = String(localOrder.delivery_status || '').trim();
        const newStatus = String(waseetOrder.status_id || waseetOrder.state_id || waseetOrder.status || '').trim();

        const updates: any = {};
        const changesList: string[] = [];
        let statusChanged = false;
        let priceChanged = false;
        let accountChanged = false;
        let addressChanged = false;

        // Compare status (مقارنة صارمة بعد التطبيع)
        const statusChangedCheck = currentStatus !== '' && newStatus !== '' && currentStatus !== newStatus;

        // 🔒 حماية partial_delivery من المزامنة التلقائية
        const isPartialDelivery = localOrder.order_type === 'partial_delivery';

        if (statusChangedCheck) {
          const statusConfig = getStatusConfig(newStatus);
          let finalStatus = statusConfig.localStatus || statusConfig.internalStatus || 'delivery';
          
          // 🔒 حماية مطلقة partial_delivery - لا نغير status أبداً عند المزامنة
          if (isPartialDelivery) {
            // partial_delivery يبقى كما هو - فقط delivery_status يتغير
            finalStatus = localOrder.status;
            console.log(`🔒 [PARTIAL-PROTECTED] ${localOrder.tracking_number} محمي - status يبقى ${localOrder.status}`);
          } else {
            // الطلبات العادية: تطبيق منطق المزامنة الكامل
            if (localOrder.status === 'delivered' || localOrder.status === 'completed') {
              // حماية delivered/completed من التغيير
              finalStatus = localOrder.status;
            } else if (newStatus === '4') {
              finalStatus = 'delivered';
            } else if (newStatus === '21') {
              // ✅ الحالة 21 = تسليم جزئي - تحتاج معالجة يدوية من الموظف
              finalStatus = 'partial_delivery';
              updates.order_type = 'partial_delivery';
              updates.is_partial_delivery = true;
              console.log(`📦 [PARTIAL-21] ${localOrder.tracking_number} تحويل لتسليم جزئي`);
            } else if (newStatus === '17') {
              finalStatus = 'returned_in_stock';
            } else if (newStatus === '31' || newStatus === '32') {
              finalStatus = 'cancelled';
            }
          }
          
          console.log(`🔄 تحديث ${localOrder.tracking_number}:`, {
            delivery_status: `${currentStatus} → ${newStatus} (${statusConfig.text})`,
            status: `${localOrder.status} → ${finalStatus}`
          });
          
          updates.delivery_status = newStatus;
          updates.status = finalStatus;
          statusChanged = true;
          changesList.push(`الحالة: ${currentStatus} → ${newStatus} (${statusConfig.text})`);
        }

        // ✅ مزامنة العنوان دائماً (بغض النظر عن تغيير الحالة)
        if (waseetOrder.city_name && localOrder.customer_city !== waseetOrder.city_name) {
          updates.customer_city = waseetOrder.city_name;
          addressChanged = true;
          changesList.push(`المدينة: ${localOrder.customer_city} → ${waseetOrder.city_name}`);
        }
        if (waseetOrder.region_name && localOrder.customer_province !== waseetOrder.region_name) {
          updates.customer_province = waseetOrder.region_name;
          addressChanged = true;
          changesList.push(`المنطقة: ${localOrder.customer_province} → ${waseetOrder.region_name}`);
        }
        // مزامنة العنوان التفصيلي
        if (waseetOrder.location && localOrder.customer_address !== waseetOrder.location) {
          updates.customer_address = waseetOrder.location;
          addressChanged = true;
          changesList.push(`العنوان: ${localOrder.customer_address} → ${waseetOrder.location}`);
        }

        // Compare prices (تجاهل للطلبات الجزئية - السعر ثابت)
        const currentFinalAmount = parseInt(String(localOrder.final_amount || 0));
        const newFinalAmount = parseInt(String(waseetOrder.price || 0));
        const currentDeliveryFee = parseInt(String(localOrder.delivery_fee || 0));

        // ✅ تحديث السعر فقط عند تغيّر فعلي من الشريك (لا تخمين خصم وهمي)
        // ⚠️ هام: الـ triggers تحسب final_amount = total_amount + delivery_fee
        // لذلك يجب تحديث total_amount بدلاً من final_amount مباشرة
        if (!isPartialDelivery && newFinalAmount > 0 && currentFinalAmount !== newFinalAmount) {
          // حساب total_amount الجديد (السعر الكلي - رسوم التوصيل)
          const newTotalAmount = Math.max(0, newFinalAmount - currentDeliveryFee);

          // ✅ جلب السعر الأصلي للمنتجات من order_items
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('unit_price, quantity')
            .eq('order_id', localOrder.id);

          const originalProductsTotal = (orderItems || []).reduce(
            (sum: number, item: any) => sum + (parseInt(String(item.unit_price || 0)) * parseInt(String(item.quantity || 1))),
            0
          );

          // ✅ حساب الخصم/الزيادة (فقط عند تغير حقيقي للسعر من الشريك)
          const priceDiff = originalProductsTotal - newTotalAmount;

          if (priceDiff > 0) {
            updates.discount = priceDiff;
            updates.price_increase = 0;
            updates.price_change_type = 'discount';
            console.log(`🔻 خصم: ${priceDiff.toLocaleString()} د.ع (أصلي: ${originalProductsTotal}, جديد: ${newTotalAmount})`);
          } else if (priceDiff < 0) {
            updates.discount = 0;
            updates.price_increase = Math.abs(priceDiff);
            updates.price_change_type = 'increase';
            console.log(`🔺 زيادة: ${Math.abs(priceDiff).toLocaleString()} د.ع (أصلي: ${originalProductsTotal}, جديد: ${newTotalAmount})`);
          } else {
            updates.discount = 0;
            updates.price_increase = 0;
            updates.price_change_type = null;
          }

          updates.total_amount = newTotalAmount;
          updates.sales_amount = newTotalAmount;
          priceChanged = true;

          console.log(`💵 تحديث السعر: original=${originalProductsTotal}, new=${newTotalAmount}, diff=${priceDiff}, delivery_fee=${currentDeliveryFee}`);

          // إعادة حساب الأرباح
          const { data: profitRecord } = await supabase
            .from('profits')
            .select('*')
            .eq('order_id', localOrder.id)
            .maybeSingle();

          if (profitRecord) {
            const priceDifference = newFinalAmount - currentFinalAmount;
            const employeeShare = Math.floor(priceDifference * 0.5);

            await supabase
              .from('profits')
              .update({
                total_revenue: newFinalAmount,
                employee_profit: employeeShare,
                updated_at: new Date().toISOString()
              })
              .eq('id', profitRecord.id);

            console.log(`💰 تحديث الأرباح للطلب ${localOrder.order_number}: ${priceDifference} د.ع`);
          }

          const currentNotes = localOrder.notes || '';
          updates.notes = `${currentNotes}\n[${new Date().toISOString()}] السعر تغير من ${currentFinalAmount.toLocaleString()} إلى ${newFinalAmount.toLocaleString()} د.ع`;
          changesList.push(`السعر: ${currentFinalAmount} → ${newFinalAmount} د.ع`);
        }

        // Compare account
        if (waseetOrder._account && localOrder.delivery_account_used !== waseetOrder._account) {
          accountChanged = true;
          updates.delivery_account_used = waseetOrder._account;
          changesList.push(`الحساب: ${waseetOrder._account}`);
        }

        if (statusChanged || priceChanged || accountChanged || addressChanged) {
          // ✅ إشعار فقط عند تغيّر الحالة فعلياً — تغيّر السعر/العنوان لا يرسل إشعار حالة
          if (notificationsEnabled && statusChanged) {
            // بناء رسالة الإشعار: مدينة - منطقة | نص الحالة بالعربي رقم_التتبع
            const statusConfig = statusChanged ? getStatusConfig(newStatus) : null;
            const statusText = statusConfig?.text || '';
            const tracking = localOrder.tracking_number || localOrder.order_number || '';
            const cityPart = localOrder.customer_province || localOrder.customer_city || '';
            const regionPart = localOrder.customer_city && localOrder.customer_province ? localOrder.customer_city : '';
            const locationLabel = [cityPart, regionPart].filter(Boolean).join(' - ');

            let notificationMessage: string;
            let notificationTitle: string;
            if (statusChanged) {
              notificationTitle = locationLabel
                ? `${locationLabel} | ${statusText}`
                : statusText || 'تحديث حالة الطلب';
              notificationMessage = `${statusText} ${tracking}`.trim();
            } else {
              notificationTitle = 'تحديث من شركة التوصيل';
              notificationMessage = `الطلب ${tracking}: ${changesList.join('، ')}`;
            }

            const notificationData: Record<string, unknown> = {
              order_id: localOrder.id,
              order_number: localOrder.order_number,
              tracking_number: localOrder.tracking_number,
              employee_id: localOrder.created_by,
              customer_city: localOrder.customer_city,
              customer_province: localOrder.customer_province,
              account: waseetOrder._account,
            };
            if (statusChanged) {
              notificationData.state_id = newStatus;
              notificationData.delivery_status = newStatus;
              notificationData.status_text = statusText;
            }
            if (priceChanged) {
              notificationData.new_price = newFinalAmount;
              notificationData.price_changed = true;
            }

            // إشعار للموظف صاحب الطلب
            notificationsToInsert.push({
              user_id: localOrder.created_by,
              type: 'alwaseet_status_change',
              title: notificationTitle,
              message: notificationMessage,
              priority: statusChanged && (newStatus === '4' || newStatus === '17') ? 'high' : 'normal',
              data: notificationData,
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

        // ✅ تحديث الطلب: نُحدّث last_synced_at دائماً (نجح فحص الشريك)
        // ولا نُحدّث updated_at إلا عند تغيّر فعلي
        const nowIso = new Date().toISOString();
        if (Object.keys(updates).length > 0) {
          updates.updated_at = nowIso;
          updates.last_synced_at = nowIso;
          if (statusChanged) updates.status_changed_at = nowIso;

          const { error: updateError } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', localOrder.id);

          if (updateError) {
            console.error(`❌ فشل تحديث الطلب ${localOrder.order_number}:`, updateError);
          } else if (statusChanged || priceChanged || accountChanged || addressChanged) {
            console.log(`✅ تم حفظ التغييرات للطلب ${localOrder.tracking_number}`);
          }
        } else {
          // لا تغييرات: نُحدّث last_synced_at فقط (ختم زمني لآخر فحص ناجح)
          await supabase
            .from('orders')
            .update({ last_synced_at: nowIso })
            .eq('id', localOrder.id);
        }

        if (!statusChanged && !priceChanged && !accountChanged && !addressChanged) {
          console.log(`⏰ الطلب ${localOrder.tracking_number} لا توجد تغييرات (last_synced_at محدّث)`);
        }
      } catch (orderError: any) {
        console.error(`❌ خطأ في معالجة الطلب ${localOrder.order_number}:`, orderError.message);
      }
    }

    // ✅ Dedup عالمي: لكل طلب، نحتفظ بإشعار واحد لكل حالة. عند تغيّر الحالة نُحدّث الإشعار نفسه (يصبح غير مقروء)
    if (notificationsEnabled && notificationsToInsert.length > 0) {
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      for (const notif of notificationsToInsert) {
        try {
          const orderId = (notif.data as any)?.order_id;
          const stateId = (notif.data as any)?.state_id ?? null;
          if (!orderId) {
            await supabase.from('notifications').insert(notif);
            inserted++;
            continue;
          }

          // ابحث عن أحدث إشعار alwaseet_status_change لنفس الطلب (آخر 7 أيام)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: existing } = await supabase
            .from('notifications')
            .select('id, data, is_read')
            .eq('user_id', notif.user_id)
            .eq('type', 'alwaseet_status_change')
            .gte('created_at', sevenDaysAgo)
            .order('created_at', { ascending: false })
            .limit(20);

          const sameOrder = (existing || []).find((n: any) => 
            (n.data?.order_id === orderId) || (n.data?.tracking_number && n.data?.tracking_number === (notif.data as any)?.tracking_number)
          );

          if (sameOrder) {
            const sameState = stateId && sameOrder.data?.state_id && String(sameOrder.data.state_id) === String(stateId);
            if (sameState) {
              // نفس الحالة لنفس الطلب → تخطي دائماً حتى لو كان مقروءاً
              skipped++;
              continue;
            }
            // حالة جديدة (أو سابقاً مقروء) → حدّث الإشعار نفسه ليصبح غير مقروء بمحتوى جديد
            await supabase
              .from('notifications')
              .update({
                title: notif.title,
                message: notif.message,
                priority: notif.priority,
                data: notif.data,
                is_read: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sameOrder.id);
            updated++;
          } else {
            await supabase.from('notifications').insert(notif);
            inserted++;
          }
        } catch (e: any) {
          console.warn('⚠️ فشل dedup إشعار:', e?.message);
        }
      }
      console.log(`📬 إشعارات: جديد=${inserted}، محدّث=${updated}، متخطى=${skipped}`);
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

    // ✅ تسجيل تشغيل ناجح في background_sync_logs ليظهر في لوحة المزامنة
    try {
      const partnersTouched = Array.from(new Set(allTokens.map(t => t.partner_name || 'alwaseet'))).join(',');
      await supabase.from('background_sync_logs').insert({
        sync_type: `sync-order-updates [${partnersTouched}]`,
        invoices_synced: 0,
        orders_updated: updatedCount,
        success: true,
      });
    } catch (logErr) {
      console.warn('⚠️ تعذّر كتابة background_sync_logs:', (logErr as any)?.message);
    }

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
