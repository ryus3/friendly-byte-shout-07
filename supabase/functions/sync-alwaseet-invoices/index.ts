import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 بدء مزامنة الفواتير اليومية التلقائية...');

    // 1. جلب إعدادات المزامنة
    const { data: settings, error: settingsError } = await supabase
      .from('invoice_sync_settings')
      .select('*')
      .single();

    if (settingsError || !settings?.daily_sync_enabled) {
      console.log('⏸️ المزامنة اليومية معطلة أو لا توجد إعدادات');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'المزامنة اليومية معطلة',
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. جلب الموظفين النشطين مع رمز Al-Waseet
    const { data: employees, error: empError } = await supabase
      .from('profiles')
      .select('user_id, full_name, username')
      .eq('is_active', true)
      .neq('user_id', '91484496-b887-44f7-9e5d-be9db5567604'); // استبعاد المدير

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

    // 3. مزامنة فواتير كل موظف
    let totalSynced = 0;
    let totalProcessed = 0;
    const results = [];

    for (const employee of employees) {
      try {
        console.log(`🔄 مزامنة فواتير الموظف: ${employee.full_name || employee.username}`);

        // استدعاء الدالة proxy لجلب الفواتير من Al-Waseet API
        const { data: invoiceData, error: apiError } = await supabase.functions.invoke('alwaseet-proxy', {
          body: {
            endpoint: 'get_merchant_invoices',
            method: 'GET',
            token: Deno.env.get('ALWASEET_TOKEN'), // يجب إضافة هذا كسر
            payload: null,
            queryParams: { token: Deno.env.get('ALWASEET_TOKEN') }
          }
        });

        if (apiError || !invoiceData?.data) {
          console.warn(`⚠️ تعذر جلب فواتير الموظف ${employee.full_name}: ${apiError?.message || 'لا توجد بيانات'}`);
          results.push({
            employee_id: employee.user_id,
            employee_name: employee.full_name || employee.username,
            success: false,
            error: apiError?.message || 'لا توجد بيانات',
            synced: 0
          });
          continue;
        }

        // 4. حفظ الفواتير مع تنظيف تلقائي للاحتفاظ بـ10 فواتير فقط
        const { data: upsertResult, error: upsertError } = await supabase
          .rpc('upsert_alwaseet_invoice_list_with_strict_cleanup', {
            p_invoices: invoiceData.data,
            p_employee_id: employee.user_id
          });

        if (upsertError) {
          console.error(`❌ خطأ في حفظ فواتير الموظف ${employee.full_name}:`, upsertError);
          results.push({
            employee_id: employee.user_id,
            employee_name: employee.full_name || employee.username,
            success: false,
            error: upsertError.message,
            synced: 0
          });
          continue;
        }

        const syncedCount = upsertResult?.processed || 0;
        totalSynced += syncedCount;
        totalProcessed++;

        // 5. مزامنة تفاصيل كل فاتورة (قائمة الطلبات) مع قاعدة البيانات الموحدة
        const token = Deno.env.get('ALWASEET_TOKEN');
        if (!token) {
          console.warn('⚠️ مفقود متغير ALWASEET_TOKEN - سيتم حفظ الفواتير بدون تفاصيل الطلبات');
        } else {
          for (const inv of invoiceData.data) {
            try {
              // جلب تفاصيل الطلبات لكل فاتورة
              const { data: invoiceOrdersResp, error: ordersErr } = await supabase.functions.invoke('alwaseet-proxy', {
                body: {
                  endpoint: 'get_merchant_invoice_orders',
                  method: 'GET',
                  token,
                  payload: null,
                  queryParams: { token, id: inv.id }
                }
              });

              if (ordersErr) {
                console.warn(`⚠️ تعذر جلب طلبات الفاتورة ${inv.id}:`, ordersErr.message);
                continue;
              }

              if (invoiceOrdersResp?.data) {
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
                } else {
                  console.log(`✅ تم مزامنة تفاصيل الفاتورة ${inv.id} مع ${ordersData.length} طلب`);
                }
              }
            } catch (e) {
              console.warn(`⚠️ استثناء أثناء مزامنة تفاصيل الفاتورة ${inv.id}:`, e.message);
            }
          }
        }

        results.push({
          employee_id: employee.user_id,
          employee_name: employee.full_name || employee.username,
          success: true,
          synced: syncedCount,
          deleted_old: upsertResult?.deleted_old || 0
        });

        console.log(`✅ تم مزامنة ${syncedCount} فاتورة للموظف ${employee.full_name}`);

      } catch (empError) {
        console.error(`❌ خطأ في معالجة الموظف ${employee.full_name}:`, empError);
        results.push({
          employee_id: employee.user_id,
          employee_name: employee.full_name || employee.username,
          success: false,
          error: empError.message,
          synced: 0
        });
      }
    }

    // تم إزالة أي مزامنة مستهدفة خاصة لضمان نظام موحد بالكامل بدون استثناءات
    console.log(`🎉 مزامنة يومية مكتملة: ${totalSynced} فاتورة لـ ${totalProcessed} موظف`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `تم مزامنة ${totalSynced} فاتورة لـ ${totalProcessed} موظف`,
        total_employees: employees.length,
        processed_employees: totalProcessed,
        total_synced: totalSynced,
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
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});