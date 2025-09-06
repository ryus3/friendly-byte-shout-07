import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { 
      mode = 'smart', // smart, specific_employee, comprehensive
      employee_id = null,
      force_refresh = false,
      sync_invoices = true,
      sync_orders = true
    } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🚀 Smart Sync بدء - نوع: ${mode}, موظف: ${employee_id || 'الكل'}`);

    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';
    
    // جلب الموظفين النشطين (استبعاد المدير)
    let employeeQuery = supabase
      .from('profiles')
      .select('user_id, full_name, username')
      .eq('is_active', true)
      .neq('user_id', ADMIN_ID);

    if (mode === 'specific_employee' && employee_id) {
      employeeQuery = employeeQuery.eq('user_id', employee_id);
    }

    const { data: employees, error: empError } = await employeeQuery;

    if (empError || !employees?.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'لا يوجد موظفين نشطين للمزامنة' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalResults = {
      employees_processed: 0,
      invoices_synced: 0,
      orders_updated: 0,
      needs_login: [],
      errors: []
    };

    // معالجة متوازية محسنة
    const BATCH_SIZE = mode === 'comprehensive' ? 3 : 5;
    const employeeBatches = [];
    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      employeeBatches.push(employees.slice(i, i + BATCH_SIZE));
    }

    for (const batch of employeeBatches) {
      const batchPromises = batch.map(employee => 
        processSmartEmployeeSync(employee, supabase, { sync_invoices, sync_orders, force_refresh })
      );
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const empResult = result.value;
          totalResults.employees_processed++;
          totalResults.invoices_synced += empResult.invoices_synced;
          totalResults.orders_updated += empResult.orders_updated;
          if (empResult.needs_login) {
            totalResults.needs_login.push(empResult.employee_name);
          }
        } else {
          totalResults.errors.push({
            employee: batch[index].full_name,
            error: result.reason?.message || 'خطأ غير معروف'
          });
        }
      });
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // تسجيل النتائج
    await supabase.from('auto_sync_log').insert({
      sync_type: `smart_${mode}`,
      triggered_by: 'smart_sync_optimized',
      employees_processed: totalResults.employees_processed,
      invoices_synced: totalResults.invoices_synced,
      orders_updated: totalResults.orders_updated,
      success: totalResults.errors.length === 0,
      results: JSON.stringify(totalResults),
      completed_at: new Date().toISOString()
    });

    console.log(`✅ Smart Sync مكتمل في ${duration}ث: ${totalResults.invoices_synced} فاتورة، ${totalResults.orders_updated} طلب`);

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        duration_seconds: duration,
        ...totalResults,
        message: `Smart Sync مكتمل - ${totalResults.invoices_synced} فاتورة جديدة، ${totalResults.orders_updated} طلب محدث`,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ في Smart Sync:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        duration: Math.round((Date.now() - startTime) / 1000)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// المعالجة الذكية للموظف الواحد
async function processSmartEmployeeSync(employee: any, supabase: any, options: any) {
  try {
    console.log(`🔄 Smart sync للموظف: ${employee.full_name}`);
    
    // 1. التحقق من التوكن أولاً
    const { data: tokenData, error: tokenError } = await supabase
      .from('delivery_partner_tokens')
      .select('token, expires_at')
      .eq('user_id', employee.user_id)
      .eq('partner_name', 'alwaseet')
      .gte('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData?.token) {
      return {
        employee_name: employee.full_name,
        needs_login: true,
        invoices_synced: 0,
        orders_updated: 0
      };
    }

    let invoicesSynced = 0;
    let ordersUpdated = 0;

    // 2. مزامنة الفواتير (إذا مطلوب)
    if (options.sync_invoices) {
      const invoiceResult = await syncEmployeeInvoicesOnly(employee, tokenData.token, supabase, options.force_refresh);
      invoicesSynced = invoiceResult.synced;
    }

    // 3. مزامنة حالات الطلبات (إذا مطلوب)
    if (options.sync_orders) {
      const ordersResult = await syncEmployeeOrdersOnly(employee, tokenData.token, supabase);
      ordersUpdated = ordersResult.updated;
    }

    return {
      employee_name: employee.full_name,
      needs_login: false,
      invoices_synced: invoicesSynced,
      orders_updated: ordersUpdated
    };

  } catch (error) {
    console.error(`❌ خطأ في Smart sync للموظف ${employee.full_name}:`, error);
    throw error;
  }
}

// مزامنة الفواتير فقط - ذكية وسريعة
async function syncEmployeeInvoicesOnly(employee: any, token: string, supabase: any, forceRefresh: boolean) {
  try {
    // التحقق من آخر مزامنة
    if (!forceRefresh) {
      const { data: lastSync } = await supabase
        .from('employee_invoice_sync_log')
        .select('last_sync_at')
        .eq('employee_id', employee.user_id)
        .single();

      const lastSyncTime = lastSync?.last_sync_at ? new Date(lastSync.last_sync_at) : null;
      const now = new Date();
      const timeDiff = lastSyncTime ? (now.getTime() - lastSyncTime.getTime()) / (1000 * 60) : Infinity;

      // إذا كانت آخر مزامنة أقل من 5 دقائق، تخطي
      if (timeDiff < 5) {
        console.log(`⏭️ تخطي مزامنة الفواتير للموظف ${employee.full_name} - تمت مؤخراً`);
        return { synced: 0 };
      }
    }

    // جلب الفواتير من API
    const { data: invoiceData, error: apiError } = await supabase.functions.invoke('alwaseet-proxy', {
      body: {
        endpoint: 'get_merchant_invoices',
        method: 'GET',
        token: token,
        queryParams: { token: token }
      }
    });

    if (apiError || !invoiceData?.data) {
      console.warn(`⚠️ تعذر جلب فواتير ${employee.full_name}`);
      return { synced: 0 };
    }

    // حفظ مع تنظيف ذكي - آخر 10 فواتير فقط
    const { data: upsertResult } = await supabase.rpc('upsert_alwaseet_invoice_list_for_user', {
      p_invoices: invoiceData.data,
      p_employee_id: employee.user_id
    });

    // تحديث سجل المزامنة
    await supabase.from('employee_invoice_sync_log').upsert({
      employee_id: employee.user_id,
      last_sync_at: new Date().toISOString(),
      invoices_synced: upsertResult?.processed || 0
    });

    return { synced: upsertResult?.processed || 0 };

  } catch (error) {
    console.warn(`⚠️ خطأ في مزامنة فواتير ${employee.full_name}:`, error);
    return { synced: 0 };
  }
}

// مزامنة حالات الطلبات فقط - سريع ومحدود
async function syncEmployeeOrdersOnly(employee: any, token: string, supabase: any) {
  try {
    // جلب الطلبات الحديثة فقط (آخر 30 يوم)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, delivery_partner_order_id, tracking_number, delivery_status')
      .eq('delivery_partner', 'alwaseet')
      .eq('created_by', employee.user_id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('delivery_partner_order_id', 'is', null)
      .limit(50);

    if (!recentOrders?.length) {
      return { updated: 0 };
    }

    let updatedCount = 0;

    // تحديث حالات الطلبات بدفعات صغيرة
    for (const order of recentOrders.slice(0, 20)) { // حد أقصى 20 طلب لسرعة المعالجة
      try {
        const { data: orderStatusData } = await supabase.functions.invoke('alwaseet-proxy', {
          body: {
            endpoint: 'merchant-orders',
            method: 'GET',
            token: token,
            queryParams: { 
              token: token,
              qr_id: order.delivery_partner_order_id 
            }
          }
        });

        if (orderStatusData?.data?.length > 0) {
          const latestStatus = orderStatusData.data[0];
          const newStatus = String(latestStatus.state_id || latestStatus.status || '').trim();
          
          if (newStatus && newStatus !== order.delivery_status) {
            await supabase
              .from('orders')
              .update({ 
                delivery_status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id);
            
            updatedCount++;
          }
        }
      } catch (orderError) {
        // تسجيل صامت للأخطاء الفردية
        console.warn(`⚠️ تخطي طلب ${order.delivery_partner_order_id}:`, orderError.message);
      }
    }

    return { updated: updatedCount };

  } catch (error) {
    console.warn(`⚠️ خطأ في مزامنة طلبات ${employee.full_name}:`, error);
    return { updated: 0 };
  }
}