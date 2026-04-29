import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ API Base URLs for both delivery partners
const ALWASEET_API_BASE = 'https://api.ryusbrand.com/alwaseet/v1/merchant';
const MODON_API_BASE = 'https://mcht.modon-express.net/v1/merchant';
// 🛡️ ميزانيات آمنة:
// - عدد الفواتير المعالجة في كل دورة (أحدث أولاً + الناقصة).
// - عدد جلب تفاصيل طلبات الفاتورة في الدورة الواحدة (لتجنب rate limit).
// - الفجوة الزمنية بين كل استدعاء تفاصيل وآخر.
// المنطق الجديد يعطي أولوية للفواتير التي orders_count > 0 وعدد طلباتها المخزن أقل من المتوقع
// (سواء جديدة أو مستلمة لكن طلباتها لم تُجلب بعد).
const MAX_INVOICES_PER_TOKEN = 25;
const MAX_ORDER_DETAILS_PER_TOKEN = 8;
const ORDER_DETAILS_GAP_MS = 900;

interface SyncRequest {
  mode: 'smart' | 'comprehensive';
  employee_id?: string;
  sync_invoices?: boolean;
  sync_orders?: boolean;
  force_refresh?: boolean;
  run_reconciliation?: boolean;
  // 🆕 وضع موجه: عند فتح فاتورة من الواجهة وكانت طلباتها ناقصة، نمرر external_id الخاص بها
  // لتُعالج فوراً بدون انتظار الميزانية، بدون تأثير على باقي الفواتير.
  target_invoice_external_id?: string;
  target_invoice_partner?: 'alwaseet' | 'modon';
}

interface Invoice {
  id: number;
  merchant_price?: number;
  amount?: number;
  status: string;
  created_at?: string;
  updated_at?: string;
  delivered_orders_count?: number;
  orders_count?: number;
  ordersCount?: number;
  received?: boolean;
  [key: string]: unknown;
}

interface InvoiceOrder {
  id: number;
  price?: number;
  amount?: number;
  status?: string;
  [key: string]: unknown;
}

const isAlWaseet = (partner: string) => partner === 'alwaseet';

class InvoiceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceAuthError';
  }
}

async function fetchDeliveryJson(url: string, token: string): Promise<{ response: Response; data: any }> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    const errorText = await response.text().catch(() => '');
    data = { raw: errorText.substring(0, 500) };
  }

  return { response, data };
}

function extractInvoiceOrders(data: any): InvoiceOrder[] {
  if (Array.isArray(data?.data?.orders)) return data.data.orders;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

// ✅ Fetch ALL invoices from API (supports both AlWaseet and MODON)
// 🛡️ ملاحظة: واجهات الفواتير في توثيق الوسيط تقبل Merchant token فقط؛ Merchant user token يرجع errNum:21
// ("ليس لديك صلاحية الوصول.") ـ وهذا ليس خطأ، بل يعني ببساطة لا فواتير لهذا الحساب. نتعامل معه كـ [].
const invoiceTime = (invoice: Invoice) => new Date(String(invoice.updated_at || invoice.created_at || 0)).getTime() || 0;

async function fetchInvoicesFromAPI(token: string, partner: string = 'alwaseet', limit: number = MAX_INVOICES_PER_TOKEN): Promise<Invoice[]> {
  const baseUrl = partner === 'modon' ? MODON_API_BASE : ALWASEET_API_BASE;
  console.log(`📡 Fetching invoices from ${partner.toUpperCase()} API (static proxy only for whitelist)...`);

  let response: Response;
  let data: any;
  try {
    const r = await fetchDeliveryJson(`${baseUrl}/get_merchant_invoices?token=${encodeURIComponent(token)}`, token);
    response = r.response;
    data = r.data;
  } catch (error) {
    // فشل شبكي/تحليلي حقيقي — نرجع فارغ لكي لا يُمسح الكاش، ولا نُسجّل auth error.
    console.error(`Network error fetching invoices from ${partner}:`, error);
    return [];
  }

  // 🛡️ errNum:21 على واجهة الفواتير = "ليس لديك صلاحية / توكن غير مناسب لـ endpoint الفواتير"
  // نُترجمها إلى InvoiceAuthError ليلتقطها fetchInvoicesWithTokenRecovery ويحاول تجديد توكن مرّة واحدة.
  if (data?.errNum === 21 || data?.errNum === '21') {
    throw new InvoiceAuthError(`${partner.toUpperCase()}: get_merchant_invoices errNum:21`);
  }

  if (data?.raw && !response.ok) {
    console.error(`API non-JSON ${response.status}: ${String(data.raw).substring(0, 200)}`);
    return [];
  }

  if (!response.ok && data?.errNum !== 'S000') {
    console.error(`API Error: ${response.status} ${response.statusText} - ${JSON.stringify(data).substring(0, 200)}`);
    return [];
  }

  const invoices = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  const limitedInvoices = [...invoices].sort((a, b) => invoiceTime(b) - invoiceTime(a)).slice(0, limit);
  console.log(`📥 ${partner.toUpperCase()} API: status=${data?.status}, errNum=${data?.errNum}, count=${invoices.length}, processing=${limitedInvoices.length}`);
  return limitedInvoices;
}

async function fetchInvoiceOrdersFromAPI(token: string, invoiceId: string, partner: string = 'alwaseet'): Promise<InvoiceOrder[]> {
  try {
    const baseUrl = partner === 'modon' ? MODON_API_BASE : ALWASEET_API_BASE;
    console.log(`📡 Fetching orders for invoice ${invoiceId} from ${partner.toUpperCase()} (static proxy only)...`);

    const { response, data } = await fetchDeliveryJson(`${baseUrl}/get_merchant_invoice_orders?token=${encodeURIComponent(token)}&invoice_id=${encodeURIComponent(invoiceId)}`, token);

    if (data?.errNum === 21 || data?.errNum === '21') {
      console.warn(`⚠️ ${partner.toUpperCase()} invoice_orders ${invoiceId}: errNum:21 (لا صلاحية على endpoint).`);
      return [];
    }

    if (!response.ok) {
      console.error(`API Error fetching orders for invoice ${invoiceId}: ${response.status} - ${JSON.stringify(data).substring(0, 200)}`);
      return [];
    }

    const ok = data?.status === true || data?.errNum === 'S000';
    if (!ok) return [];
    return extractInvoiceOrders(data);
  } catch (error) {
    console.error(`Error fetching orders for invoice ${invoiceId}:`, error);
    return [];
  }
}

async function renewAlWaseetTokenIfNeeded(supabase: any, tokenData: any): Promise<string | null> {
  if ((tokenData.partner_name || 'alwaseet') !== 'alwaseet') return null;
  const username = tokenData.account_username || tokenData.partner_data?.username;
  const password = tokenData.partner_data?.password;
  if (!username || !password) return null;

  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  const response = await fetch(`${ALWASEET_API_BASE}/login`, { method: 'POST', body: formData, headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.status || !data?.data?.token) {
    console.warn(`⚠️ Could not renew AlWaseet merchant token for ${username}: ${data?.msg || response.status}`);
    return null;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await supabase
    .from('delivery_partner_tokens')
    .update({ token: data.data.token, expires_at: expiresAt.toISOString(), last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', tokenData.id);
  console.log(`🔑 Renewed AlWaseet merchant token for ${username}`);
  return data.data.token;
}

async function fetchInvoicesWithTokenRecovery(supabase: any, tokenData: any, partnerName: string): Promise<Invoice[]> {
  try {
    return await fetchInvoicesFromAPI(tokenData.token, partnerName, MAX_INVOICES_PER_TOKEN);
  } catch (error) {
    if (error instanceof InvoiceAuthError) {
      console.warn(`🔑 Invoice API rejected stored token for ${tokenData.account_username}; renewing once from saved merchant credentials.`);
      const renewedToken = await renewAlWaseetTokenIfNeeded(supabase, tokenData);
      if (renewedToken) return await fetchInvoicesFromAPI(renewedToken, partnerName, MAX_INVOICES_PER_TOKEN);
    }
    throw error;
  }
}

/**
 * ✅ تطبيع حالة الفاتورة مع التفريق بين المندوب والتاجر
 * - "تم الاستلام من قبل المندوب" = pending (معلقة - لم تصل للتاجر بعد)
 * - "تم الاستلام من قبل التاجر" = received (مستلمة فعلياً)
 */
function normalizeStatus(status: string | null): string {
  if (!status) return 'pending';
  const statusLower = status.toLowerCase();
  const statusOriginal = status;
  
  // ✅ المندوب = معلقة (لم تصل للتاجر بعد)
  if (statusOriginal.includes('المندوب') || statusOriginal.includes('مندوب')) {
    return 'pending';
  }
  
  // ✅ التاجر = مستلمة فعلياً
  if (statusOriginal.includes('التاجر') || statusOriginal.includes('تاجر')) {
    return 'received';
  }
  
  // ✅ كلمة "مستلم" بدون تحديد = نفترض مستلمة
  if (statusOriginal.includes('مستلم') || statusOriginal.includes('تم استلام')) {
    return 'received';
  }
  
  // ✅ English statuses
  if (statusLower.includes('receiv')) return 'received';
  if (statusLower.includes('pend') || statusOriginal.includes('معلق') || statusOriginal.includes('انتظار')) return 'pending';
  if (statusLower.includes('cancel') || statusOriginal.includes('ملغ')) return 'cancelled';
  if (statusLower.includes('sent') || statusOriginal.includes('ارسال') || statusOriginal.includes('أرسل')) return 'sent';
  
  return statusLower;
}

/**
 * ✅ استخراج تاريخ الاستلام
 */
function extractReceivedAt(invoice: Invoice): string | null {
  if (invoice.updated_at) return invoice.updated_at;
  if (invoice.created_at) return invoice.created_at;
  return new Date().toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const { 
      mode = 'smart', 
      employee_id, 
      sync_invoices = true, 
      sync_orders = true,  // ✅ تفعيل افتراضي - مهم للربط التلقائي
      force_refresh = false,
      run_reconciliation = true,
      target_invoice_external_id,
      target_invoice_partner,
    } = body;

    console.log(`🔄 Smart Invoice Sync - Mode: ${mode}, Employee: ${employee_id || 'all'}, SyncOrders: ${sync_orders}, ForceRefresh: ${force_refresh}, Target: ${target_invoice_external_id || '-'}`);

    // 🆕 وضع الجلب الموجه لفاتورة واحدة فقط (يُستدعى من واجهة فتح تفاصيل الفاتورة).
    // لا يلمس باقي الفواتير، ولا يعيد المزامنة العامة، ولا يُعدّ "موجة طلبات".
    if (target_invoice_external_id) {
      const partnerName = target_invoice_partner || 'alwaseet';
      const { data: invRow, error: invErr } = await supabase
        .from('delivery_invoices')
        .select('id, owner_user_id, partner, external_id, orders_count, raw, account_username, merchant_id')
        .eq('external_id', String(target_invoice_external_id))
        .eq('partner', partnerName)
        .maybeSingle();

      if (invErr || !invRow) {
        return new Response(
          JSON.stringify({ success: false, mode: 'targeted', error: 'invoice_not_found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // عدد الطلبات المخزنة حالياً
      const { count: cachedCount } = await supabase
        .from('delivery_invoice_orders')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', invRow.id);

      const expected = Number(invRow.orders_count || 0);
      const haveNow = cachedCount ?? 0;

      // إن كانت كاملة، لا حاجة للمزامنة الموجهة
      if (expected > 0 && haveNow >= expected) {
        return new Response(
          JSON.stringify({ success: true, mode: 'targeted', invoices_synced: 0, orders_updated: 0, already_complete: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // اختيار توكن مالك الفاتورة بنفس الشريك
      const { data: tokenRow } = await supabase
        .from('delivery_partner_tokens')
        .select('id, token, account_username, partner_data, partner_name, user_id')
        .eq('user_id', invRow.owner_user_id)
        .eq('partner_name', partnerName)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_used_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenRow?.token) {
        return new Response(
          JSON.stringify({ success: false, mode: 'targeted', error: 'no_active_token' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let ordersFromApi = await fetchInvoiceOrdersFromAPI(tokenRow.token, String(invRow.external_id), partnerName);

      // محاولة تجديد توكن الوسيط لمرة واحدة عند فشل الجلب وإعادة المحاولة
      if (ordersFromApi.length === 0 && partnerName === 'alwaseet') {
        const renewed = await renewAlWaseetTokenIfNeeded(supabase, tokenRow);
        if (renewed) {
          ordersFromApi = await fetchInvoiceOrdersFromAPI(renewed, String(invRow.external_id), partnerName);
        }
      }

      let writtenOrders = 0;
      if (ordersFromApi.length > 0) {
        for (const order of ordersFromApi) {
          const { error: orderError } = await supabase
            .from('delivery_invoice_orders')
            .upsert({
              invoice_id: invRow.id,
              external_order_id: String(order.id),
              raw: order,
              status: order.status,
              amount: order.price || order.amount || 0,
              owner_user_id: invRow.owner_user_id,
            }, { onConflict: 'invoice_id,external_order_id', ignoreDuplicates: false });
          if (!orderError) writtenOrders++;
        }
        await supabase
          .from('delivery_invoices')
          .update({ orders_last_synced_at: new Date().toISOString() })
          .eq('id', invRow.id);

        try {
          await supabase.rpc('link_invoice_orders_to_orders');
        } catch { /* silent */ }
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'targeted',
          target_invoice: invRow.external_id,
          expected_orders: expected,
          cached_before: haveNow,
          orders_updated: writtenOrders,
          orders_returned_from_api: ordersFromApi.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalInvoicesSynced = 0;
    let totalOrdersUpdated = 0;
    let newInvoicesCount = 0;
    let statusChangedCount = 0;
    const employeeResults: Record<string, { invoices: number; orders: number; newInvoices: number }> = {};

    // ========== COMPREHENSIVE MODE ==========
    if (mode === 'comprehensive') {
      const { data: tokens, error: tokensError } = await supabase
        .from('delivery_partner_tokens')
        .select('id, user_id, token, account_username, merchant_id, expires_at, partner_name')
        .eq('is_active', true)
        .in('partner_name', ['alwaseet', 'modon'])  // ✅ دعم كلا الشركتين
        .gt('expires_at', new Date().toISOString());

      if (tokensError) {
        console.error('Error fetching tokens:', tokensError);
        throw new Error('Failed to fetch employee tokens');
      }

      console.log(`📋 Found ${tokens?.length || 0} active tokens to sync`);

      for (const tokenData of tokens || []) {
        const employeeId = tokenData.user_id;
        const accountUsername = tokenData.account_username || 'unknown';
        const partnerName = tokenData.partner_name || 'alwaseet';  // ✅ تحديد الشركة
        
        console.log(`👤 Syncing ALL invoices for employee: ${employeeId} (${accountUsername}) - Partner: ${partnerName.toUpperCase()}`);

        try {
          // ✅ جلب جميع الفواتير من API المناسب للشركة
          const apiInvoices = await fetchInvoicesWithTokenRecovery(supabase, tokenData, partnerName);
          console.log(`  📥 Fetched ${apiInvoices.length} total invoices from ${partnerName.toUpperCase()} API`);

          let employeeInvoicesSynced = 0;
          let employeeOrdersSynced = 0;
          let employeeNewInvoices = 0;

          let orderDetailsFetchedForToken = 0;

          // 🆕 منطق "الفواتير الناقصة أولاً":
          // 1) نرتب فواتير API بالأحدث أولاً.
          // 2) نقرأ من DB حالة الكاش (cachedOrdersCount مقابل expectedOrders) لجميع الفواتير دفعة واحدة.
          // 3) نقدم الفواتير التي expectedOrders > 0 وكاشها أقل من المتوقع.
          // النتيجة: الفواتير الجديدة الكبيرة (مثل 223 طلب) لا تبقى فارغة.
          const sortedApi = [...apiInvoices].sort((a, b) => invoiceTime(b) - invoiceTime(a));
          const externalIds = sortedApi.map(inv => String(inv.id));
          const dbStateMap = new Map<string, { id: string; received: boolean; cached: number; expected: number }>();
          if (externalIds.length > 0) {
            const { data: existingRows } = await supabase
              .from('delivery_invoices')
              .select('id, external_id, received, orders_count')
              .eq('partner', partnerName)
              .in('external_id', externalIds);
            if (existingRows && existingRows.length > 0) {
              const ids = existingRows.map(r => r.id);
              const counts = new Map<string, number>();
              if (ids.length > 0) {
                const { data: dioRows } = await supabase
                  .from('delivery_invoice_orders')
                  .select('invoice_id')
                  .in('invoice_id', ids);
                (dioRows || []).forEach(r => counts.set(r.invoice_id, (counts.get(r.invoice_id) || 0) + 1));
              }
              existingRows.forEach(r => {
                dbStateMap.set(String(r.external_id), {
                  id: r.id,
                  received: r.received === true,
                  cached: counts.get(r.id) || 0,
                  expected: Number(r.orders_count || 0),
                });
              });
            }
          }
          const incompleteFirst = [...sortedApi].sort((a, b) => {
            const sa = dbStateMap.get(String(a.id));
            const sb = dbStateMap.get(String(b.id));
            const expA = Number((a as any).delivered_orders_count || (a as any).orders_count || (a as any).ordersCount || 0);
            const expB = Number((b as any).delivered_orders_count || (b as any).orders_count || (b as any).ordersCount || 0);
            const incA = expA > 0 && (!sa || sa.cached < expA) ? 1 : 0;
            const incB = expB > 0 && (!sb || sb.cached < expB) ? 1 : 0;
            if (incA !== incB) return incB - incA; // الناقصة أولاً
            return invoiceTime(b) - invoiceTime(a);
          });
          const queue = incompleteFirst.slice(0, MAX_INVOICES_PER_TOKEN);

          // ✅ معالجة الفواتير حسب الأولوية؛ تفاصيل الطلبات لها ميزانية محدودة لمنع rate limit
          for (const invoice of queue) {
            const externalId = String(invoice.id);
            const statusNormalized = normalizeStatus(invoice.status);
            const isReceived = statusNormalized === 'received' || invoice.received === true;
            const receivedAt = isReceived ? extractReceivedAt(invoice) : null;

            // التحقق إذا كانت الفاتورة موجودة - ✅ استخدام partnerName بدلاً من 'alwaseet' الثابت
            const { data: existingInvoice } = await supabase
              .from('delivery_invoices')
              .select('id, received, received_at, status_normalized')
              .eq('external_id', externalId)
              .eq('partner', partnerName)
              .maybeSingle();

            // ✅ إذا موجودة ومستلمة في DB ولم نطلب force = نتأكد أولاً أن delivery_invoice_orders ممتلئة
            // قبل التخطي. كان السلوك السابق يتخطى دائماً مما يترك الفواتير المستلمة بدون طلبات في الكاش.
            if (existingInvoice?.received === true && !force_refresh) {
              const { count: existingDioCount } = await supabase
                .from('delivery_invoice_orders')
                .select('id', { count: 'exact', head: true })
                .eq('invoice_id', existingInvoice.id);
              const expectedDio = Number(invoice.delivered_orders_count || invoice.orders_count || invoice.ordersCount || 0);
              if ((existingDioCount ?? 0) >= expectedDio && expectedDio > 0) {
                continue;
              }
              // وإلا نتابع لجلب الطلبات وتعبئة الكاش (self-healing)
              console.log(`  🩹 Received invoice ${externalId} cache incomplete (have=${existingDioCount ?? 0}, expected=${expectedDio}) — re-fetching orders`);
            }

            // ✅ تحقق من تغيير الحالة
            const isNew = !existingInvoice;
            const statusChanged = existingInvoice && existingInvoice.status_normalized !== statusNormalized;
            
            if (isNew) {
              console.log(`  🆕 New invoice ${externalId} (status: ${statusNormalized})`);
              employeeNewInvoices++;
              newInvoicesCount++;
            } else if (statusChanged) {
              console.log(`  📝 Invoice ${externalId} status changed: ${existingInvoice.status_normalized} → ${statusNormalized}`);
              statusChangedCount++;
            }

            // Upsert - ✅ استخدام partnerName بدلاً من 'alwaseet' الثابت
            const { data: upsertedInvoice, error: upsertError } = await supabase
              .from('delivery_invoices')
              .upsert({
                external_id: externalId,
                partner: partnerName,  // ✅ الشركة الصحيحة
                owner_user_id: employeeId,
                account_username: accountUsername,
                merchant_id: tokenData.merchant_id,
                amount: invoice.merchant_price || invoice.amount || 0,
                orders_count: invoice.delivered_orders_count || invoice.orders_count || invoice.ordersCount || 0,
                status: invoice.status,
                status_normalized: statusNormalized,
                received: isReceived,
                received_flag: isReceived,
                received_at: isReceived ? (existingInvoice?.received_at || receivedAt) : null,
                // ✅ تاريخ الفاتورة الفعلي من شركة التوصيل (updated_at من API)، ليس وقت المزامنة
                issued_at: invoice.updated_at || invoice.created_at || new Date().toISOString(),
                raw: invoice,
                last_synced_at: new Date().toISOString(),
                last_api_updated_at: invoice.updated_at || new Date().toISOString(),
              }, {
                onConflict: 'external_id,partner',
                ignoreDuplicates: false,
              })
              .select('id')
              .maybeSingle();

            if (upsertError) {
              console.error(`  ❌ Error upserting invoice ${externalId}:`, upsertError.message);
            } else {
              employeeInvoicesSynced++;
              
              // ✅ مزامنة طلبات الفاتورة - استخدام partnerName وبهدوء شديد لمنع rate limit
              const expectedForOrders = Number(invoice.delivered_orders_count || invoice.orders_count || invoice.ordersCount || 0);
              if (sync_orders && upsertedInvoice?.id && expectedForOrders > 0 && orderDetailsFetchedForToken < MAX_ORDER_DETAILS_PER_TOKEN) {
                try {
                  if (orderDetailsFetchedForToken > 0) await new Promise(r => setTimeout(r, ORDER_DETAILS_GAP_MS));
                  orderDetailsFetchedForToken++;
                  const invoiceOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId, partnerName);
                  
                  if (invoiceOrders.length > 0) {
                    for (const order of invoiceOrders) {
                      const { error: orderError } = await supabase
                        .from('delivery_invoice_orders')
                        .upsert({
                          invoice_id: upsertedInvoice.id,
                          external_order_id: String(order.id),
                          raw: order,
                          status: order.status,
                          amount: order.price || order.amount || 0,
                          owner_user_id: employeeId,
                        }, {
                          onConflict: 'invoice_id,external_order_id',
                          ignoreDuplicates: false,
                        });
                      
                      if (!orderError) employeeOrdersSynced++;
                    }
                    
                    // ✅ لا نعمل retry داخل نفس التشغيل؛ cron/UI سيعيد المحاولة لاحقاً بدون عاصفة طلبات.
                    if (false && !isReceived) {
                      const expected = Number(invoice.delivered_orders_count || invoice.orders_count || invoice.ordersCount || 0);
                      let { count: dioNow } = await supabase
                        .from('delivery_invoice_orders')
                        .select('id', { count: 'exact', head: true })
                        .eq('invoice_id', upsertedInvoice.id);
                      let haveNow = dioNow ?? 0;
                      const delays = [5000, 10000, 20000];
                      for (let attempt = 0; attempt < delays.length && expected > 0 && haveNow < expected; attempt++) {
                        console.log(`    🔁 Snapshot incomplete for ${externalId}: have=${haveNow}, expected=${expected}. Retry ${attempt + 1}/${delays.length} after ${delays[attempt]}ms...`);
                        await new Promise(r => setTimeout(r, delays[attempt]));
                        const retryOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId, partnerName);
                        if (retryOrders.length > 0) {
                          for (const order of retryOrders) {
                            const { error: rErr } = await supabase
                              .from('delivery_invoice_orders')
                              .upsert({
                                invoice_id: upsertedInvoice.id,
                                external_order_id: String(order.id),
                                raw: order,
                                status: order.status,
                                amount: order.price || order.amount || 0,
                                owner_user_id: employeeId,
                              }, {
                                onConflict: 'invoice_id,external_order_id',
                                ignoreDuplicates: false,
                              });
                            if (!rErr) employeeOrdersSynced++;
                          }
                        } else {
                          console.log(`    ⚠️ Retry ${attempt + 1} returned 0 orders for ${externalId} (API rate-limit/issue)`);
                        }
                        const { count: dioAfter } = await supabase
                          .from('delivery_invoice_orders')
                          .select('id', { count: 'exact', head: true })
                          .eq('invoice_id', upsertedInvoice.id);
                        haveNow = dioAfter ?? 0;
                        console.log(`    📊 After retry ${attempt + 1} for ${externalId}: have=${haveNow}, expected=${expected}`);
                      }
                    }

                    await supabase
                      .from('delivery_invoices')
                      .update({ orders_last_synced_at: new Date().toISOString() })
                      .eq('id', upsertedInvoice.id);
                  } else if (isReceived) {
                    // ✅ FALLBACK: إذا فشل جلب الطلبات من API وكانت الفاتورة مستلمة
                    // نبحث عن طلبات محلية مرتبطة بهذه الفاتورة
                    console.log(`    ⚠️ No orders from API for received invoice ${externalId}, trying local fallback...`);
                    
                    const { data: localOrders } = await supabase
                      .from('orders')
                      .select('id, tracking_number, final_amount')
                      .eq('delivery_partner_invoice_id', externalId)
                      .in('delivery_status', ['4', '5', '21']);
                    
                    if (localOrders && localOrders.length > 0) {
                      console.log(`    🔄 Found ${localOrders.length} local orders for invoice ${externalId}`);
                      for (const order of localOrders) {
                        const { error: fallbackError } = await supabase
                          .from('delivery_invoice_orders')
                          .upsert({
                            invoice_id: upsertedInvoice.id,
                            external_order_id: order.tracking_number,
                            order_id: order.id,
                            amount: order.final_amount || 0,
                            status: 'delivered',
                            owner_user_id: employeeId,
                            raw: { id: order.tracking_number, fallback: true },
                          }, {
                            onConflict: 'invoice_id,external_order_id',
                            ignoreDuplicates: false,
                          });
                        
                        if (!fallbackError) employeeOrdersSynced++;
                      }
                    }
                  }
                } catch (ordersError) {
                  console.error(`    ❌ Error syncing orders for invoice ${externalId}:`, ordersError);
                }
              } else if (sync_orders && upsertedInvoice?.id && expectedForOrders > 0) {
                console.log(`    ⏭️ Invoice ${externalId} order details deferred to next sync (budget ${orderDetailsFetchedForToken}/${MAX_ORDER_DETAILS_PER_TOKEN})`);
              }
            }
          }

          employeeResults[employeeId] = {
            invoices: employeeInvoicesSynced,
            orders: employeeOrdersSynced,
            newInvoices: employeeNewInvoices,
          };
          totalInvoicesSynced += employeeInvoicesSynced;
          totalOrdersUpdated += employeeOrdersSynced;

          console.log(`  ✅ Synced ${employeeInvoicesSynced} invoices (${employeeNewInvoices} new), ${employeeOrdersSynced} orders`);

        } catch (employeeError) {
          console.error(`  ❌ Error syncing employee ${employeeId}:`, employeeError);
          employeeResults[employeeId] = { invoices: 0, orders: 0, newInvoices: 0 };
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Update token last sync times
      if (tokens && tokens.length > 0) {
        await supabase
          .from('delivery_partner_tokens')
          .update({ 
            last_used_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString()
          })
          .in('id', tokens.map(t => t.id));
      }

    } else {
      // ========== SMART MODE ==========
      // ✅ تعديل: جلب كل الفواتير وليس فقط 5
      
      let targetEmployeeId = employee_id;

      if (!targetEmployeeId) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
          const { data: { user } } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
          );
          targetEmployeeId = user?.id;
        }
      }

      if (!targetEmployeeId) {
        return new Response(
          JSON.stringify({ error: 'No employee_id provided and no authenticated user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tokensData, error: tokensError } = await supabase
        .from('delivery_partner_tokens')
        .select('id, token, account_username, merchant_id, partner_name')  // ✅ إضافة partner_name
        .eq('user_id', targetEmployeeId)
        .eq('is_active', true)
        .in('partner_name', ['alwaseet', 'modon'])  // ✅ دعم كلا الشركتين
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false });

      if (tokensError || !tokensData || tokensData.length === 0) {
        console.log(`⚠️ No active tokens for employee ${targetEmployeeId}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            invoices_synced: 0, 
            message: 'No active token found' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`👤 Employee ${targetEmployeeId} has ${tokensData.length} active token(s)`);

      for (const tokenData of tokensData) {
        const partnerName = tokenData.partner_name || 'alwaseet';  // ✅ تحديد الشركة
        console.log(`🔄 Syncing token: ${tokenData.account_username} (merchant: ${tokenData.merchant_id}) - Partner: ${partnerName.toUpperCase()}`);
        
        // ✅ جلب أحدث الفواتير فقط من API المناسب للشركة
          const apiInvoices = await fetchInvoicesWithTokenRecovery(supabase, tokenData, partnerName);
        console.log(`📥 Processing ${apiInvoices.length} invoices for ${tokenData.account_username} from ${partnerName.toUpperCase()}`);

        let orderDetailsFetchedForToken = 0;

        // 🆕 ترتيب الفواتير: الناقصة أولاً (orders_count > 0 وكاش delivery_invoice_orders أقل من المتوقع)،
        // ثم الباقي بالأحدث. هذا يضمن إصلاح الفواتير الجديدة الكبيرة قبل الفواتير القديمة المكتملة.
        const sortedApi = [...apiInvoices].sort((a, b) => invoiceTime(b) - invoiceTime(a));
        const externalIdsSmart = sortedApi.map(inv => String(inv.id));
        const dbStateMapSmart = new Map<string, { id: string; cached: number; expected: number; received: boolean }>();
        if (externalIdsSmart.length > 0) {
          const { data: existingRows } = await supabase
            .from('delivery_invoices')
            .select('id, external_id, received, orders_count')
            .eq('partner', partnerName)
            .in('external_id', externalIdsSmart);
          if (existingRows && existingRows.length > 0) {
            const ids = existingRows.map(r => r.id);
            const counts = new Map<string, number>();
            if (ids.length > 0) {
              const { data: dioRows } = await supabase
                .from('delivery_invoice_orders')
                .select('invoice_id')
                .in('invoice_id', ids);
              (dioRows || []).forEach(r => counts.set(r.invoice_id, (counts.get(r.invoice_id) || 0) + 1));
            }
            existingRows.forEach(r => {
              dbStateMapSmart.set(String(r.external_id), {
                id: r.id,
                received: r.received === true,
                cached: counts.get(r.id) || 0,
                expected: Number(r.orders_count || 0),
              });
            });
          }
        }
        const incompleteFirstSmart = [...sortedApi].sort((a, b) => {
          const expA = Number((a as any).delivered_orders_count || (a as any).orders_count || (a as any).ordersCount || 0);
          const expB = Number((b as any).delivered_orders_count || (b as any).orders_count || (b as any).ordersCount || 0);
          const sa = dbStateMapSmart.get(String(a.id));
          const sb = dbStateMapSmart.get(String(b.id));
          const incA = expA > 0 && (!sa || sa.cached < expA) ? 1 : 0;
          const incB = expB > 0 && (!sb || sb.cached < expB) ? 1 : 0;
          if (incA !== incB) return incB - incA;
          return invoiceTime(b) - invoiceTime(a);
        });
        const queueSmart = incompleteFirstSmart.slice(0, MAX_INVOICES_PER_TOKEN);

        // ✅ معالجة الفواتير حسب الأولوية
        for (const invoice of queueSmart) {
          const externalId = String(invoice.id);
          const statusNormalized = normalizeStatus(invoice.status);
          const isReceived = statusNormalized === 'received' || invoice.received === true;
          const receivedAt = isReceived ? extractReceivedAt(invoice) : null;

          // Check existing - ✅ استخدام partnerName بدلاً من 'alwaseet' الثابت
          const { data: existing } = await supabase
            .from('delivery_invoices')
            .select('id, status_normalized, received, received_at, orders_count')
            .eq('external_id', externalId)
            .eq('partner', partnerName)
            .maybeSingle();

          const expectedCount = Number(invoice.delivered_orders_count || invoice.orders_count || invoice.ordersCount || existing?.orders_count || 0);
          let cachedOrdersCount = 0;
          if (existing?.id && sync_orders && expectedCount > 0) {
            const { count } = await supabase
              .from('delivery_invoice_orders')
              .select('id', { count: 'exact', head: true })
              .eq('invoice_id', existing.id);
            cachedOrdersCount = count ?? 0;
          }

          // ✅ Skip if already received in DB and cache is complete. If orders are missing, self-heal.
          if (existing?.received === true && !force_refresh) {
            if (!sync_orders || expectedCount === 0 || cachedOrdersCount >= expectedCount) {
              continue;
            }
            console.log(`  🩹 Received invoice ${externalId} cache incomplete: have=${cachedOrdersCount}, expected=${expectedCount}`);
          }

          const isNew = !existing;
          const statusChanged = existing && existing.status_normalized !== statusNormalized;
          
          if (isNew) {
            console.log(`  🆕 New invoice ${externalId} (${statusNormalized})`);
            newInvoicesCount++;
          } else if (statusChanged) {
            console.log(`  📝 Invoice ${externalId}: ${existing.status_normalized} → ${statusNormalized}`);
            statusChangedCount++;
          }

          // Skip if no changes — لكن لا نقفز إذا طلبات الفاتورة ناقصة (received أو pending)
          if (!force_refresh && existing && !statusChanged && existing.received === isReceived) {
            if (sync_orders && expectedCount > 0 && cachedOrdersCount < expectedCount) {
              console.log(`  ⚙️ Invoice ${externalId} needs order completion: have=${cachedOrdersCount}, expected=${expectedCount}`);
            } else {
              continue;
            }
          }

          const { data: upsertedInvoice, error: upsertError } = await supabase
            .from('delivery_invoices')
            .upsert({
              external_id: externalId,
              partner: partnerName,  // ✅ الشركة الصحيحة
              owner_user_id: targetEmployeeId,
              account_username: tokenData.account_username,
              merchant_id: tokenData.merchant_id,
              amount: invoice.merchant_price || invoice.amount || 0,
              orders_count: invoice.delivered_orders_count || invoice.orders_count || invoice.ordersCount || 0,
              status: invoice.status,
              status_normalized: statusNormalized,
              received: isReceived,
              received_flag: isReceived,
              received_at: isReceived ? (existing?.received_at || receivedAt) : null,
              issued_at: invoice.created_at || new Date().toISOString(),  // ✅ ضمان ملء issued_at
              raw: invoice,
              last_synced_at: new Date().toISOString(),
            }, {
              onConflict: 'external_id,partner',
              ignoreDuplicates: false,
            })
            .select('id')
            .maybeSingle();

          if (!upsertError) {
            totalInvoicesSynced++;
            
            const shouldSyncOrders = sync_orders && upsertedInvoice?.id && expectedCount > 0 && (cachedOrdersCount < expectedCount) && orderDetailsFetchedForToken < MAX_ORDER_DETAILS_PER_TOKEN;
            if (shouldSyncOrders) {
              try {
                if (orderDetailsFetchedForToken > 0) await new Promise(r => setTimeout(r, ORDER_DETAILS_GAP_MS));
                orderDetailsFetchedForToken++;
                const invoiceOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId, partnerName);  // ✅ تمرير partnerName
                
                if (invoiceOrders.length > 0) {
                  for (const order of invoiceOrders) {
                    const { error: orderError } = await supabase
                      .from('delivery_invoice_orders')
                      .upsert({
                        invoice_id: upsertedInvoice.id,
                        external_order_id: String(order.id),
                        raw: order,
                        status: order.status,
                        amount: order.price || order.amount || 0,
                        owner_user_id: targetEmployeeId,
                      }, {
                        onConflict: 'invoice_id,external_order_id',
                        ignoreDuplicates: false,
                      });
                    
                    if (!orderError) totalOrdersUpdated++;
                  }
                  
                  // ✅ لا نعمل retry داخل نفس التشغيل؛ التشغيل التالي يكمل بدون تجاوز حد الوسيط.
                  if (false && !isReceived) {
                    const expected = Number(invoice.delivered_orders_count || invoice.orders_count || invoice.ordersCount || 0);
                    let { count: dioNow } = await supabase
                      .from('delivery_invoice_orders')
                      .select('id', { count: 'exact', head: true })
                      .eq('invoice_id', upsertedInvoice.id);
                    let haveNow = dioNow ?? 0;
                    const delays = [5000, 10000, 20000];
                    for (let attempt = 0; attempt < delays.length && expected > 0 && haveNow < expected; attempt++) {
                      console.log(`  🔁 Snapshot incomplete for ${externalId}: have=${haveNow}, expected=${expected}. Retry ${attempt + 1}/${delays.length} after ${delays[attempt]}ms...`);
                      await new Promise(r => setTimeout(r, delays[attempt]));
                      const retryOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId, partnerName);
                      if (retryOrders.length > 0) {
                        for (const order of retryOrders) {
                          const { error: rErr } = await supabase
                            .from('delivery_invoice_orders')
                            .upsert({
                              invoice_id: upsertedInvoice.id,
                              external_order_id: String(order.id),
                              raw: order,
                              status: order.status,
                              amount: order.price || order.amount || 0,
                              owner_user_id: targetEmployeeId,
                            }, {
                              onConflict: 'invoice_id,external_order_id',
                              ignoreDuplicates: false,
                            });
                          if (!rErr) totalOrdersUpdated++;
                        }
                      } else {
                        console.log(`  ⚠️ Retry ${attempt + 1} returned 0 orders for ${externalId} (API rate-limit/issue)`);
                      }
                      const { count: dioAfter } = await supabase
                        .from('delivery_invoice_orders')
                        .select('id', { count: 'exact', head: true })
                        .eq('invoice_id', upsertedInvoice.id);
                      haveNow = dioAfter ?? 0;
                      console.log(`  📊 After retry ${attempt + 1} for ${externalId}: have=${haveNow}, expected=${expected}`);
                    }
                  }

                  await supabase
                    .from('delivery_invoices')
                    .update({ orders_last_synced_at: new Date().toISOString() })
                    .eq('id', upsertedInvoice.id);
                } else if (isReceived) {
                  // ✅ FALLBACK: إذا فشل جلب الطلبات من API وكانت الفاتورة مستلمة
                  console.log(`  ⚠️ No orders from API for received invoice ${externalId}, trying local fallback...`);
                  
                  const { data: localOrders } = await supabase
                    .from('orders')
                    .select('id, tracking_number, final_amount')
                    .eq('delivery_partner_invoice_id', externalId)
                    .in('delivery_status', ['4', '5', '21']);
                  
                  if (localOrders && localOrders.length > 0) {
                    console.log(`  🔄 Found ${localOrders.length} local orders for invoice ${externalId}`);
                    for (const order of localOrders) {
                      const { error: fallbackError } = await supabase
                        .from('delivery_invoice_orders')
                        .upsert({
                          invoice_id: upsertedInvoice.id,
                          external_order_id: order.tracking_number,
                          order_id: order.id,
                          amount: order.final_amount || 0,
                          status: 'delivered',
                          owner_user_id: targetEmployeeId,
                          raw: { id: order.tracking_number, fallback: true },
                        }, {
                          onConflict: 'invoice_id,external_order_id',
                          ignoreDuplicates: false,
                        });
                      
                      if (!fallbackError) totalOrdersUpdated++;
                    }
                  }
                }
              } catch (ordersError) {
                console.error(`Error syncing orders for invoice ${externalId}:`, ordersError);
              }
            } else if (sync_orders && upsertedInvoice?.id && expectedCount > 0) {
              if (cachedOrdersCount >= expectedCount) {
                console.log(`  ✅ Invoice ${externalId} orders cache already complete: have=${cachedOrdersCount}, expected=${expectedCount}`);
              } else {
                console.log(`  ⏭️ Invoice ${externalId} order details deferred to next sync (budget ${orderDetailsFetchedForToken}/${MAX_ORDER_DETAILS_PER_TOKEN})`);
              }
            }
          }
        }
        
        await supabase
          .from('delivery_partner_tokens')
          .update({ 
            last_used_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString()
          })
          .eq('id', tokenData.id);
        
        if (tokensData.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      employeeResults[targetEmployeeId] = {
        invoices: totalInvoicesSynced,
        orders: totalOrdersUpdated,
        newInvoices: newInvoicesCount,
      };
      
      console.log(`✅ Smart sync complete for employee ${targetEmployeeId}: ${totalInvoicesSynced} invoices (${newInvoicesCount} new)`);
    }

    // ✅ Link invoice orders to local orders
    let linkedCount = 0;
    let updatedOrdersCount = 0;
    try {
      const { data: linkResult, error: linkError } = await supabase.rpc('link_invoice_orders_to_orders');
      if (linkError) {
        console.warn('⚠️ Failed to link invoice orders:', linkError.message);
      } else if (linkResult && linkResult.length > 0) {
        linkedCount = linkResult[0].linked_count || 0;
        updatedOrdersCount = linkResult[0].updated_orders_count || 0;
        console.log(`🔗 Linked ${linkedCount} invoice orders, updated ${updatedOrdersCount} orders`);
      }
    } catch (linkErr) {
      console.warn('⚠️ Error calling link_invoice_orders_to_orders:', linkErr);
    }

    // Log sync result
    await supabase.from('background_sync_logs').insert({
      sync_type: mode === 'comprehensive' ? 'comprehensive_invoice_sync' : 'smart_invoice_sync',
      success: true,
      invoices_synced: totalInvoicesSynced,
      orders_updated: totalOrdersUpdated + linkedCount,
    });

    console.log(`✅ Sync complete - Invoices: ${totalInvoicesSynced}, New: ${newInvoicesCount}, StatusChanged: ${statusChangedCount}, Orders: ${totalOrdersUpdated}, Linked: ${linkedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        invoices_synced: totalInvoicesSynced,
        new_invoices: newInvoicesCount,
        status_changed: statusChangedCount,
        orders_updated: totalOrdersUpdated,
        linked_count: linkedCount,
        employee_results: employeeResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Smart Invoice Sync Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
