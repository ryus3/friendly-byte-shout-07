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
      mode = 'smart', // smart, specific_employee, specific_employee_smart, comprehensive
      employee_id = null,
      force_refresh = false,
      sync_invoices = true,
      sync_orders = true
    } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user from authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    let currentUserId = null;
    
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        currentUserId = user?.id;
      } catch (e) {
        console.warn('تعذر التحقق من المستخدم الحالي');
      }
    }

    console.log(`🚀 Smart Sync بدء - نوع: ${mode}, موظف: ${employee_id || 'الكل'}, المستخدم الحالي: ${currentUserId}`);

    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';
    
    // جلب الموظفين النشطين
    let employeeQuery = supabase
      .from('profiles')
      .select('user_id, full_name, username, role')
      .eq('is_active', true);

    // للموظف المحدد - المدير يمكنه الوصول لأي موظف
    if ((mode === 'specific_employee' || mode === 'specific_employee_smart') && employee_id) {
      const { data: currentUser } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', currentUserId || ADMIN_ID)
        .single();
      
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'deputy_admin';
      
      if (isAdmin) {
        // المدير يمكنه مزامنة أي موظف
        employeeQuery = employeeQuery.eq('user_id', employee_id);
        console.log(`🔑 صلاحيات المدير: مزامنة الموظف ${employee_id}`);
      } else {
        // الموظف العادي فقط لنفسه
        employeeQuery = employeeQuery.eq('user_id', currentUserId || employee_id);
        console.log(`👤 صلاحيات الموظف: مزامنة نفسه فقط`);
      }
    } else {
      // استبعاد المدير من المزامنة الجماعية
      employeeQuery = employeeQuery.neq('user_id', ADMIN_ID);
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
        processSmartEmployeeSync(employee, supabase, { sync_invoices, sync_orders, force_refresh, currentUserId })
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
        message: totalResults.invoices_synced > 0 
          ? `تم جلب ${totalResults.invoices_synced} فاتورة جديدة وتحديث ${totalResults.orders_updated} طلب في ${duration} ثانية` 
          : `لا توجد فواتير جديدة - فحص ${totalResults.employees_processed} موظف في ${duration} ثانية`,
        performance: {
          employees_per_second: Math.round(totalResults.employees_processed / duration * 10) / 10,
          total_operations: totalResults.invoices_synced + totalResults.orders_updated
        },
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
      const ordersResult = await syncEmployeeOrdersOnly(employee, tokenData.token, supabase, options.currentUserId);
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

// مزامنة الفواتير فقط - ذكية وسريعة مع فلترة محسنة
async function syncEmployeeInvoicesOnly(employee: any, token: string, supabase: any, forceRefresh: boolean) {
  try {
    console.log(`🔄 Smart sync للموظف: ${employee.full_name || employee.username}`);

    // التحقق من آخر مزامنة ذكية للموظف (استخدام الجدول الجديد)
    let lastSmartSync = null;
    if (!forceRefresh) {
      try {
        const { data: smartSyncData } = await supabase
          .from('employee_smart_sync_log')
          .select('last_smart_sync_at, last_invoice_date')
          .eq('employee_id', employee.user_id)
          .single();

        lastSmartSync = smartSyncData;
        
        if (lastSmartSync?.last_smart_sync_at) {
          const now = new Date();
          const timeDiff = (now.getTime() - new Date(lastSmartSync.last_smart_sync_at).getTime()) / (1000 * 60);

          // إذا كانت آخر مزامنة ذكية أقل من 3 دقائق، تخطي
          if (timeDiff < 3) {
            console.log(`⏭️ تخطي ${employee.full_name} - مزامنة ذكية حديثة (${Math.round(timeDiff)} دقيقة)`);
            return { synced: 0 };
          }
        }
      } catch (syncLogError) {
        console.warn(`⚠️ خطأ في قراءة سجل المزامنة الذكية للموظف ${employee.full_name}, سأكمل المزامنة`);
      }
    }

    // تحديد نقطة البداية للمزامنة الذكية
    let sinceDate;
    if (forceRefresh) {
      // مزامنة شاملة - آخر 60 يوم
      sinceDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    } else if (lastSmartSync?.last_invoice_date) {
      // مزامنة ذكية - من آخر فاتورة تم جلبها
      sinceDate = new Date(lastSmartSync.last_invoice_date);
    } else {
      // أول مزامنة ذكية - آخر 7 أيام
      sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }
    
    // بناء معاملات API ذكية مع تحديد الفترة
    const apiParams = { 
      token: token,
      limit: 50, // حد أقصى 50 فاتورة لتجنب الحمولة الثقيلة
      since_date: sinceDate.toISOString().split('T')[0] // فقط التاريخ بصيغة YYYY-MM-DD
    };

    console.log(`📅 جلب فواتير ${employee.full_name} منذ ${apiParams.since_date} (${forceRefresh ? 'شاملة' : 'ذكية'})`);

    // جلب الفواتير من API مع التعامل مع أخطاء Token
    let invoiceData, apiError;
    try {
      const response = await supabase.functions.invoke('alwaseet-proxy', {
        body: {
          endpoint: 'get_merchant_invoices',
          method: 'GET',
          token: token,
          queryParams: apiParams
        }
      });
      invoiceData = response.data;
      apiError = response.error;
    } catch (proxyError) {
      console.warn(`⚠️ خطأ في استدعاء API للموظف ${employee.full_name}:`, proxyError.message);
      return { synced: 0 };
    }

    if (apiError) {
      if (apiError.message?.includes('token') || apiError.message?.includes('unauthorized')) {
        console.warn(`🔑 توكن غير صالح للموظف ${employee.full_name}`);
        return { synced: 0, needs_login: true };
      }
      console.warn(`⚠️ تعذر جلب فواتير ${employee.full_name}: ${apiError.message}`);
      return { synced: 0 };
    }

    if (!invoiceData?.data || !Array.isArray(invoiceData.data)) {
      console.log(`📭 لا توجد فواتير جديدة للموظف ${employee.full_name}`);
      // تحديث سجل المزامنة الذكية حتى لو لم توجد فواتير
      try {
        await supabase.from('employee_smart_sync_log').upsert({
          employee_id: employee.user_id,
          last_smart_sync_at: new Date().toISOString(),
          last_invoice_date: lastSmartSync?.last_invoice_date || sinceDate.toISOString(),
          invoices_synced: 0,
          sync_type: forceRefresh ? 'comprehensive' : 'smart'
        });
      } catch (logError) {
        console.warn(`⚠️ تعذر تحديث سجل المزامنة الذكية للموظف ${employee.full_name}`);
      }
      return { synced: 0 };
    }

    // فلترة الفواتير الجديدة فقط بناء على التاريخ
    const newInvoices = invoiceData.data.filter(invoice => {
      const invoiceDate = new Date(invoice.updated_at || invoice.created_at);
      return invoiceDate > sinceDate;
    });

    console.log(`🔄 معالجة ${newInvoices.length} فاتورة جديدة من أصل ${invoiceData.data.length} للموظف ${employee.full_name}`);

    let syncedCount = 0;
    if (newInvoices.length > 0) {
      // حفظ مع مقاومة الأخطاء
      try {
        const { data: upsertResult, error: upsertError } = await supabase.rpc('upsert_alwaseet_invoice_list_for_user', {
          p_invoices: newInvoices,
          p_employee_id: employee.user_id
        });

        if (upsertError) {
          console.error(`❌ خطأ في حفظ فواتير ${employee.full_name}:`, upsertError);
          return { synced: 0 };
        }

        syncedCount = upsertResult?.processed || newInvoices.length;
        console.log(`✅ تمت مزامنة ${syncedCount} فاتورة جديدة للموظف ${employee.full_name}`);
      } catch (saveError) {
        console.error(`❌ خطأ في عملية الحفظ للموظف ${employee.full_name}:`, saveError);
        return { synced: 0 };
      }
    }

    // تحديث سجل المزامنة الذكية مع تاريخ آخر فاتورة
    try {
      const latestInvoiceDate = newInvoices.length > 0 
        ? new Date(Math.max(...newInvoices.map(inv => new Date(inv.updated_at || inv.created_at).getTime()))).toISOString()
        : lastSmartSync?.last_invoice_date || sinceDate.toISOString();

      await supabase.from('employee_smart_sync_log').upsert({
        employee_id: employee.user_id,
        last_smart_sync_at: new Date().toISOString(),
        last_invoice_date: latestInvoiceDate,
        invoices_synced: syncedCount,
        sync_type: forceRefresh ? 'comprehensive' : 'smart'
      });
    } catch (logError) {
      console.warn(`⚠️ تعذر تحديث سجل المزامنة الذكية للموظف ${employee.full_name}`);
    }

    if (syncedCount > 0) {
      console.log(`✅ تمت مزامنة ${syncedCount} فاتورة جديدة للموظف ${employee.full_name}`);
    }

    return { synced: syncedCount };

  } catch (error) {
    console.error(`❌ خطأ عام في مزامنة فواتير ${employee.full_name}:`, error);
    return { synced: 0 };
  }
}

// مزامنة حالات الطلبات فقط - سريع ومحدود
async function syncEmployeeOrdersOnly(employee: any, token: string, supabase: any, currentUserId?: string) {
  try {
    // جلب الطلبات الحديثة فقط (آخر 30 يوم)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // التحقق من صلاحيات المدير للوصول لطلبات الموظفين
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', currentUserId || '91484496-b887-44f7-9e5d-be9db5567604')
      .single();
    
    const isManagerAccess = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'deputy_admin';
    
    const ordersQuery = supabase
      .from('orders')
      .select('id, delivery_partner_order_id, tracking_number, qr_id, delivery_status, created_by, order_number')
      .eq('delivery_partner', 'alwaseet')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .or('delivery_partner_order_id.not.is.null,tracking_number.not.is.null,qr_id.not.is.null,order_number.not.is.null')
      .limit(isManagerAccess ? 100 : 50); // المدير يحصل على حد أعلى

    // المدير يمكنه مزامنة طلبات الموظف المحدد، الموظف فقط طلباته
    if (isManagerAccess) {
      ordersQuery.eq('created_by', employee.user_id);
      console.log(`🔍 المدير يزامن طلبات الموظف: ${employee.full_name}`);
    } else {
      ordersQuery.eq('created_by', employee.user_id);
      console.log(`🔍 الموظف يزامن طلباته الخاصة: ${employee.full_name}`);
    }

    const { data: recentOrders } = await ordersQuery;

    if (!recentOrders?.length) {
      console.log(`📭 لا توجد طلبات للمزامنة للموظف ${employee.full_name}`);
      return { updated: 0 };
    }

    console.log(`🔍 فحص ${recentOrders.length} طلب للموظف ${employee.full_name} (${isManagerAccess ? 'المدير - طلبات الموظف' : 'الموظف - طلباته فقط'})`);

    let updatedCount = 0;

    // تحديث حالات الطلبات مع دعم محسن للمعرفات
    for (const order of recentOrders.slice(0, isManagerAccess ? 50 : 20)) {
      try {
        // البحث الشامل عن معرف الطلب - دعم جميع الحقول
        const orderIdToUse = order.delivery_partner_order_id || 
                            order.tracking_number || 
                            order.qr_id || 
                            order.order_number;
        
        if (!orderIdToUse) {
          console.warn(`⚠️ لا يوجد معرف صالح للطلب ${order.id}`);
          continue;
        }

        console.log(`🔍 البحث عن الطلب: ${orderIdToUse} (المنشئ: ${order.created_by === employee.user_id ? 'نفس الموظف' : 'موظف آخر'})`);

        const { data: orderStatusData } = await supabase.functions.invoke('alwaseet-proxy', {
          body: {
            endpoint: 'merchant-orders',
            method: 'GET',
            token: token,
            queryParams: { 
              token: token,
              qr_id: orderIdToUse 
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
            console.log(`📦 تحديث حالة الطلب ${orderIdToUse}: ${order.delivery_status} → ${newStatus} (${isManagerAccess ? 'المدير' : 'الموظف'})`);
          } else {
            console.log(`📦 لا يوجد تحديث للطلب ${orderIdToUse}: ${order.delivery_status}`);
          }
        } else {
          console.warn(`⚠️ لا توجد بيانات للطلب ${orderIdToUse}`);
        }
      } catch (orderError) {
        console.warn(`⚠️ تخطي طلب ${order.delivery_partner_order_id}:`, orderError.message);
      }
    }

    return { updated: updatedCount };

  } catch (error) {
    console.warn(`⚠️ خطأ في مزامنة طلبات ${employee.full_name}:`, error);
    return { updated: 0 };
  }
}