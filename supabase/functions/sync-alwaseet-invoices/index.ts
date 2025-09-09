import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Al-Waseet state_id to local order status
const mapAlWaseetStateToLocal = (state?: string) => {
  const s = String(state || '').trim();
  
  // دعم الحالات النصية العربية أيضاً
  if (s === 'فعال' || s === 'فعال ( قيد التجهير)') return 'pending';
  
  switch (s) {
    case '1': return 'pending'; // فعال قيد التجهيز
    case '2': return 'shipped'; // تم الشحن
    case '3': return 'delivery'; // قيد التوصيل
    case '4': return 'delivered'; // تم التسليم
    case '5': 
    case '6': 
    case '7': 
    case '14': 
    case '22': 
    case '23': 
    case '24': 
    case '42': 
    case '44': return 'delivery'; // قيد التوصيل - مراحل مختلفة
    case '12':
    case '13':
    case '15':
    case '16':
    case '19':
    case '20':
    case '21':
    case '31':
    case '32': return 'returned'; // حالات الإرجاع والإلغاء
    case '17': return 'returned_in_stock'; // تم الارجاع الى التاجر
    default: return null;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const isScheduled = body.scheduled === true;
    const syncTime = body.sync_time || 'manual';
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🚀 بدء مزامنة محسنة ${isScheduled ? 'تلقائية' : 'يدوية'} - ${syncTime}...`);

    // 1. جلب إعدادات المزامنة
    const { data: settings, error: settingsError } = await supabase
      .from('invoice_sync_settings')
      .select('*')
      .single();

    if (settingsError) {
      console.log('⚠️ تعذر جلب إعدادات المزامنة، سنُكمل بالمبدئي.');
    }
    if (isScheduled && !body.force && settings && settings.daily_sync_enabled === false) {
      console.log('⏸️ المزامنة المجدولة معطلة وفق الإعدادات');
      return new Response(
        JSON.stringify({ success: true, message: 'المزامنة المجدولة معطلة', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. جلب الموظفين النشطين فقط (استبعاد المدير نهائياً)
    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';
    const { data: employees, error: empError } = await supabase
      .from('profiles')
      .select('user_id, full_name, username')
      .eq('is_active', true)
      .neq('user_id', ADMIN_ID);

    if (empError || !employees?.length) {
      console.error('❌ خطأ في جلب الموظفين:', empError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'لا يوجد موظفين نشطين' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. معالجة متوازية محسنة للموظفين (5 موظفين في المرة الواحدة لسرعة أكبر)
    let totalSynced = 0;
    let totalProcessed = 0;
    let needsLoginCount = 0;
    let ordersUpdatedTotal = 0;
    const results = [];
    const needsLoginEmployees = [];

    const BATCH_SIZE = 5; // معالجة أسرع
    const employeeBatches = [];
    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      employeeBatches.push(employees.slice(i, i + BATCH_SIZE));
    }

    for (const batch of employeeBatches) {
      const batchPromises = batch.map(employee => processEmployeeSync(employee, supabase));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const empResult = result.value;
          totalSynced += empResult.synced;
          totalProcessed += empResult.processed;
          ordersUpdatedTotal += empResult.ordersUpdated;
          if (empResult.needsLogin) needsLoginCount++;
          results.push(empResult.result);
          if (empResult.needsLogin) needsLoginEmployees.push(empResult.employeeName);
        } else {
          console.error(`⚠️ خطأ في معالجة الموظف ${batch[index].full_name}:`, result.reason);
          results.push({
            employee_id: batch[index].user_id,
            employee_name: batch[index].full_name || batch[index].username,
            success: false,
            error: 'خطأ في المعالجة المتوازية',
            synced: 0
          });
        }
      });
    }

    // تسجيل نتائج المزامنة في قاعدة البيانات
    const duration = Date.now() - startTime;
    await supabase
      .from('auto_sync_log')
      .insert({
        sync_type: isScheduled ? 'scheduled' : 'manual',
        triggered_by: isScheduled ? `system_${syncTime}` : 'admin_manual_optimized',
        employees_processed: totalProcessed,
        invoices_synced: totalSynced,
        orders_updated: ordersUpdatedTotal,
        success: true,
        results: JSON.stringify(results),
        completed_at: new Date().toISOString()
      });

    console.log(`🎉 مزامنة محسنة مكتملة في ${Math.round(duration/1000)} ثانية: معالجة ${totalSynced} فاتورة وتحديث ${ordersUpdatedTotal} طلب لـ ${totalProcessed} موظف`);

    // إعداد رسالة مفصلة
    const successMessage = totalProcessed > 0 
      ? `تم معالجة ${totalSynced} فاتورة وتحديث ${ordersUpdatedTotal} طلب لـ ${totalProcessed} موظف في ${Math.round(duration/1000)} ثانية`
      : 'لا توجد موظفين بتوكن صالح للمزامنة';
    
    const warningMessage = needsLoginCount > 0 
      ? ` - ${needsLoginCount} موظف يحتاج تسجيل دخول: ${needsLoginEmployees.join(', ')}`
      : '';

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage + warningMessage,
        total_employees: employees.length,
        employees_processed: totalProcessed,
        needs_login_count: needsLoginCount,
        needs_login_employees: needsLoginEmployees,
        invoices_synced: totalSynced,
        orders_updated: ordersUpdatedTotal,
        sync_duration: duration,
        results: results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ عام في مزامنة الفواتير:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        sync_duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// دالة معالجة مزامنة موظف واحد
async function processEmployeeSync(employee: any, supabase: any) {
  let updatedOrdersForEmployee = 0;
  try {
    console.log(`🔄 مزامنة فواتير الموظف: ${employee.full_name || employee.username}`);
    
    // جلب توكن الموظف من جدول delivery_partner_tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('delivery_partner_tokens')
      .select('token, expires_at')
      .eq('user_id', employee.user_id)
      .eq('partner_name', 'alwaseet')
      .gte('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData?.token) {
      // المدير مستبعد، لا حاجة لمعالجة خاصة
      {
        console.warn(`⚠️ لا يوجد توكن صالح للموظف ${employee.full_name || employee.username}`);
        return {
          synced: 0,
          processed: 0,
          ordersUpdated: 0,
          needsLogin: true,
          employeeName: employee.full_name || employee.username,
          result: {
            employee_id: employee.user_id,
            employee_name: employee.full_name || employee.username,
            success: false,
            error: 'يحتاج تسجيل دخول في الوسيط',
            synced: 0,
            needs_login: true
          }
        };
      }
    }

    // استدعاء الدالة proxy لجلب الفواتير من Al-Waseet API باستخدام توكن الموظف
    const { data: invoiceData, error: apiError } = await supabase.functions.invoke('alwaseet-proxy', {
      body: {
        endpoint: 'get_merchant_invoices',
        method: 'GET',
        token: tokenData.token,
        payload: null,
        queryParams: { token: tokenData.token }
      }
    });

    if (apiError || !invoiceData?.data) {
      console.warn(`⚠️ تعذر جلب فواتير الموظف ${employee.full_name}: ${apiError?.message || 'لا توجد بيانات'}`);
      return {
        synced: 0,
        processed: 0,
        ordersUpdated: 0,
        needsLogin: false,
        employeeName: employee.full_name || employee.username,
        result: {
          employee_id: employee.user_id,
          employee_name: employee.full_name || employee.username,
          success: false,
          error: apiError?.message || 'لا توجد بيانات',
          synced: 0
        }
      };
    }

    // 4. حفظ الفواتير مع تنظيف تلقائي للاحتفاظ بـ10 فواتير فقط
    const { data: upsertResult, error: upsertError } = await supabase
      .rpc('upsert_alwaseet_invoice_list_with_cleanup', {
        p_invoices: invoiceData.data,
        p_employee_id: employee.user_id
      });

    if (upsertError) {
      console.error(`❌ خطأ في حفظ فواتير الموظف ${employee.full_name}:`, upsertError);
      return {
        synced: 0,
        processed: 0,
        ordersUpdated: 0,
        needsLogin: false,
        employeeName: employee.full_name || employee.username,
        result: {
          employee_id: employee.user_id,
          employee_name: employee.full_name || employee.username,
          success: false,
          error: upsertError.message,
          synced: 0
        }
      };
    }

    const syncedCount = upsertResult?.processed || 0;

    // 5. مزامنة تفاصيل كل فاتورة - معالجة متوازية
    const invoiceProcessPromises = invoiceData.data.map((inv: any) => 
      processInvoiceDetails(inv, tokenData.token, employee, supabase)
    );
    const invoiceResults = await Promise.allSettled(invoiceProcessPromises);
    
    invoiceResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedOrdersForEmployee += result.value;
      } else {
        console.warn(`⚠️ فشل معالجة فاتورة:`, result.reason);
      }
    });

    return {
      synced: syncedCount,
      processed: 1,
      ordersUpdated: updatedOrdersForEmployee,
      needsLogin: false,
      employeeName: employee.full_name || employee.username,
      result: {
        employee_id: employee.user_id,
        employee_name: employee.full_name || employee.username,
        success: true,
        synced: syncedCount,
        orders_updated: updatedOrdersForEmployee
      }
    };
    
  } catch (empError) {
    console.error(`❌ خطأ في مزامنة الموظف ${employee.full_name}:`, empError);
    return {
      synced: 0,
      processed: 0,
      ordersUpdated: 0,
      needsLogin: false,
      employeeName: employee.full_name || employee.username,
      result: {
        employee_id: employee.user_id,
        employee_name: employee.full_name || employee.username,
        success: false,
        error: empError.message,
        synced: 0
      }
    };
  }
}

// دالة معالجة تفاصيل فاتورة واحدة
async function processInvoiceDetails(inv: any, token: string, employee: any, supabase: any) {
  try {
    // جلب تفاصيل الطلبات لكل فاتورة باستخدام توكن الموظف
    const { data: invoiceOrdersResp, error: ordersErr } = await supabase.functions.invoke('alwaseet-proxy', {
      body: {
        endpoint: 'get_merchant_invoice_orders',
        method: 'GET',
        token: token,
        payload: null,
        queryParams: { token: token, invoice_id: inv.id }
      }
    });

    if (ordersErr) {
      console.warn(`⚠️ تعذر جلب طلبات الفاتورة ${inv.id}:`, ordersErr.message);
      return 0;
    }

    if (!invoiceOrdersResp?.data) return 0;

    const invData = Array.isArray(invoiceOrdersResp.data.invoice) && invoiceOrdersResp.data.invoice.length > 0
      ? invoiceOrdersResp.data.invoice[0]
      : inv;
    const ordersData = invoiceOrdersResp.data.orders || [];

    // حفظ الفاتورة مع طلباتها في قاعدة البيانات الموحدة
    const { error: syncErr } = await supabase.rpc('sync_alwaseet_invoice_data', {
      p_invoice_data: invData,
      p_orders_data: ordersData
    });

    if (syncErr) {
      console.warn(`⚠️ خطأ في حفظ تفاصيل الفاتورة ${inv.id}:`, syncErr.message);
      return 0;
    }

    console.log(`✅ تم مزامنة تفاصيل الفاتورة ${inv.id} مع ${ordersData.length} طلب`);
    
    // معالجة متوازية لتحديث الطلبات
    const orderUpdatePromises = ordersData.map((od: any) => updateOrderStatus(od, employee, supabase));
    const orderResults = await Promise.allSettled(orderUpdatePromises);
    
    return orderResults.filter(r => r.status === 'fulfilled' && r.value).length;
  } catch (e) {
    console.warn(`⚠️ استثناء أثناء مزامنة تفاصيل الفاتورة ${inv.id}:`, e.message);
    return 0;
  }
}

// دالة تحديث حالة طلب واحد
async function updateOrderStatus(od: any, employee: any, supabase: any) {
  try {
    const externalId = String(od.id ?? od.qr_id ?? od.qrId ?? '').trim();
    if (!externalId) return false;
    
    const stateCode = String(od.state_id ?? od.stateId ?? od.status ?? '').trim();
    const localStatus = mapAlWaseetStateToLocal(stateCode);

    const { data: foundOrders, error: findErr } = await supabase
      .from('orders')
      .select('id,status,delivery_status,delivery_partner,delivery_partner_order_id,tracking_number')
      .or(`delivery_partner_order_id.eq.${externalId},tracking_number.eq.${externalId}`)
      .eq('delivery_partner', 'alwaseet')
      .limit(1);

    if (findErr || !foundOrders || foundOrders.length === 0) {
      return false;
    }

    const order = foundOrders[0];
    const updates: Record<string, unknown> = {
      delivery_status: stateCode || order.delivery_status || null,
      delivery_partner: 'alwaseet',
    };

    if (!order.delivery_partner_order_id) {
      updates.delivery_partner_order_id = externalId;
    }

    if (localStatus && localStatus !== order.status) {
      updates.status = localStatus;
    }

    const { error: updErr } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', order.id);

    if (!updErr) {
      // تحديث حالة الحجز/الإفراج عن المخزون حسب الحالة الجديدة
      const { error: resvErr } = await supabase.rpc('update_order_reservation_status', {
        p_order_id: order.id,
        p_new_status: (updates as any).status ?? order.status,
        p_new_delivery_status: stateCode || order.delivery_status,
        p_delivery_partner: 'alwaseet'
      });
      if (resvErr) {
        console.warn(`⚠️ فشل تحديث حالة الحجز للطلب ${order.id}:`, resvErr.message);
      }
      return true;
    } else {
      console.warn(`⚠️ فشل تحديث الطلب ${order.id}:`, updErr.message);
      return false;
    }
  } catch (orderErr) {
    console.warn('⚠️ استثناء أثناء تحديث حالة الطلب:', orderErr?.message || orderErr);
    return false;
  }
}