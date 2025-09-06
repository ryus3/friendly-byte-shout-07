import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Al-Waseet state_id to local order status
const mapAlWaseetStateToLocal = (state?: string) => {
  const s = String(state || '').trim();
  switch (s) {
    case '3': return 'delivery'; // قيد التوصيل
    case '4': return 'delivered'; // تم التسليم
    case '16': return 'returned'; // قيد الارجاع
    case '17': return 'returned_in_stock'; // تم الارجاع الى التاجر
    default: return null;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const isScheduled = body.scheduled === true;
    const syncTime = body.sync_time || 'manual';
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 بدء مزامنة الفواتير ${isScheduled ? 'التلقائية' : 'اليدوية'} - ${syncTime}...`);

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

    // 2. جلب الموظفين النشطين
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
    let needsLoginCount = 0;
    let ordersUpdatedTotal = 0;
    const results = [];
    const needsLoginEmployees = [];

    for (const employee of employees) {
      try {
        console.log(`🔄 مزامنة فواتير الموظف: ${employee.full_name || employee.username}`);
        let updatedOrdersForEmployee = 0;
        // جلب توكن الموظف من جدول delivery_partner_tokens
        const { data: tokenData, error: tokenError } = await supabase
          .from('delivery_partner_tokens')
          .select('token, expires_at')
          .eq('user_id', employee.user_id)
          .eq('partner_name', 'alwaseet')
          .gte('expires_at', new Date().toISOString())
          .single();

        if (tokenError || !tokenData?.token) {
          console.warn(`⚠️ لا يوجد توكن صالح للموظف ${employee.full_name || employee.username}`);
          needsLoginCount++;
          needsLoginEmployees.push(employee.full_name || employee.username);
          results.push({
            employee_id: employee.user_id,
            employee_name: employee.full_name || employee.username,
            success: false,
            error: 'يحتاج تسجيل دخول في الوسيط',
            synced: 0,
            needs_login: true
          });
          continue;
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
          .rpc('upsert_alwaseet_invoice_list_with_cleanup', {
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
        for (const inv of invoiceData.data) {
          try {
            // جلب تفاصيل الطلبات لكل فاتورة باستخدام توكن الموظف
            const { data: invoiceOrdersResp, error: ordersErr } = await supabase.functions.invoke('alwaseet-proxy', {
              body: {
                endpoint: 'get_merchant_invoice_orders',
                method: 'GET',
                token: tokenData.token,
                payload: null,
                queryParams: { token: tokenData.token, id: inv.id }
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
                // تحديث حالات الطلبات محلياً
                for (const od of ordersData) {
                  try {
                    const externalId = String(od.id ?? od.qr_id ?? od.qrId ?? '').trim();
                    if (!externalId) continue;
                    const stateCode = String(od.state_id ?? od.stateId ?? od.status ?? '').trim();
                    const localStatus = mapAlWaseetStateToLocal(stateCode);

                    const { data: foundOrders, error: findErr } = await supabase
                      .from('orders')
                      .select('id,status,delivery_status,delivery_partner,delivery_partner_order_id,tracking_number')
                      .or(`delivery_partner_order_id.eq.${externalId},tracking_number.eq.${externalId}`)
                      .eq('delivery_partner', 'alwaseet')
                      .limit(1);

                    if (findErr || !foundOrders || foundOrders.length === 0) {
                      continue;
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
                      updatedOrdersForEmployee += 1;
                      ordersUpdatedTotal += 1;
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
                    } else {
                      console.warn(`⚠️ فشل تحديث الطلب ${order.id}:`, updErr.message);
                    }
                  } catch (orderErr) {
                    console.warn('⚠️ استثناء أثناء تحديث حالة الطلب:', orderErr?.message || orderErr);
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`⚠️ استثناء أثناء مزامنة تفاصيل الفاتورة ${inv.id}:`, e.message);
          }
        }

        // 6. مزامنة شاملة للطلبات - جلب جميع طلبات الموظف من Al-Waseet وتحديث حالاتها
        try {
          console.log(`🔄 مزامنة شاملة لطلبات الموظف: ${employee.full_name || employee.username}`);
          
          // جلب جميع طلبات الموظف من Al-Waseet
          const { data: allOrdersData, error: allOrdersErr } = await supabase.functions.invoke('alwaseet-proxy', {
            body: {
              endpoint: 'get_merchant_orders',
              method: 'GET',
              token: tokenData.token,
              payload: null,
              queryParams: { token: tokenData.token }
            }
          });

          if (allOrdersErr) {
            console.warn(`⚠️ تعذر جلب طلبات الموظف ${employee.full_name}:`, allOrdersErr.message);
          } else if (allOrdersData?.data) {
            const allOrders = allOrdersData.data || [];
            console.log(`📦 تم جلب ${allOrders.length} طلب للموظف ${employee.full_name}`);
            
            // مزامنة كل طلب محلياً
            for (const orderData of allOrders) {
              try {
                const externalOrderId = String(orderData.id ?? orderData.qr_id ?? orderData.qrId ?? '').trim();
                if (!externalOrderId) continue;
                
                const stateCode = String(orderData.state_id ?? orderData.stateId ?? orderData.status ?? '').trim();
                const localStatus = mapAlWaseetStateToLocal(stateCode);

                // البحث عن الطلب المحلي بناءً على tracking_number أو delivery_partner_order_id
                const { data: localOrders, error: findOrderErr } = await supabase
                  .from('orders')
                  .select('id,status,delivery_status,delivery_partner,delivery_partner_order_id,tracking_number,created_by')
                  .or(`delivery_partner_order_id.eq.${externalOrderId},tracking_number.eq.${externalOrderId}`)
                  .eq('created_by', employee.user_id)
                  .limit(1);

                if (findOrderErr || !localOrders || localOrders.length === 0) {
                  continue;
                }

                const localOrder = localOrders[0];
                const updates: Record<string, unknown> = {
                  delivery_status: stateCode || localOrder.delivery_status || null,
                  delivery_partner: 'alwaseet',
                  updated_at: new Date().toISOString()
                };

                // ربط معرف الطلب الخارجي إذا لم يكن موجوداً
                if (!localOrder.delivery_partner_order_id) {
                  updates.delivery_partner_order_id = externalOrderId;
                }

                // تحديث الحالة المحلية إذا كانت مختلفة
                if (localStatus && localStatus !== localOrder.status) {
                  updates.status = localStatus;
                }

                // تطبيق التحديثات على الطلب المحلي
                const { error: updateErr } = await supabase
                  .from('orders')
                  .update(updates)
                  .eq('id', localOrder.id);

                if (!updateErr) {
                  updatedOrdersForEmployee += 1;
                  ordersUpdatedTotal += 1;
                  
                  console.log(`✅ تم تحديث الطلب ${externalOrderId} - حالة: ${stateCode}`);
                  
                  // تحديث حالة الحجز/الإفراج عن المخزون
                  const { error: reservationErr } = await supabase.rpc('update_order_reservation_status', {
                    p_order_id: localOrder.id,
                    p_new_status: (updates as any).status ?? localOrder.status,
                    p_new_delivery_status: stateCode || localOrder.delivery_status,
                    p_delivery_partner: 'alwaseet'
                  });
                  
                  if (reservationErr) {
                    console.warn(`⚠️ فشل تحديث حالة الحجز للطلب ${localOrder.id}:`, reservationErr.message);
                  }
                } else {
                  console.warn(`⚠️ فشل تحديث الطلب المحلي ${localOrder.id}:`, updateErr.message);
                }
              } catch (orderSyncErr) {
                console.warn('⚠️ خطأ في مزامنة طلب فردي:', orderSyncErr?.message || orderSyncErr);
              }
            }
          }
        } catch (comprehensiveSyncErr) {
          console.warn(`⚠️ خطأ في المزامنة الشاملة للموظف ${employee.full_name}:`, comprehensiveSyncErr?.message || comprehensiveSyncErr);
        }

        results.push({
          employee_id: employee.user_id,
          employee_name: employee.full_name || employee.username,
          success: true,
          synced: syncedCount,
          updated_orders: updatedOrdersForEmployee,
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

    // تسجيل نتائج المزامنة في قاعدة البيانات
    await supabase
      .from('auto_sync_log')
      .insert({
        sync_type: isScheduled ? 'scheduled' : 'manual',
        triggered_by: isScheduled ? `system_${syncTime}` : 'admin_manual',
        employees_processed: totalProcessed,
        invoices_synced: totalSynced,
        orders_updated: ordersUpdatedTotal,
        success: true,
        results: JSON.stringify(results),
        completed_at: new Date().toISOString()
      });

    console.log(`🎉 مزامنة ${isScheduled ? 'تلقائية' : 'يدوية'} مكتملة: معالجة ${totalSynced} فاتورة وتحديث ${ordersUpdatedTotal} طلب لـ ${totalProcessed} موظف`);

    // إعداد رسالة مفصلة
    const successMessage = totalProcessed > 0 
      ? `تم معالجة ${totalSynced} فاتورة وتحديث ${ordersUpdatedTotal} طلب لـ ${totalProcessed} موظف`
      : 'لا توجد موظفين بتوكن صالح للمزامنة';
    
    const warningMessage = needsLoginCount > 0 
      ? ` - ${needsLoginCount} موظف يحتاج تسجيل دخول: ${needsLoginEmployees.join(', ')}`
      : '';

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage + warningMessage,
        total_employees: employees.length,
        processed_employees: totalProcessed,
        needs_login_count: needsLoginCount,
        needs_login_employees: needsLoginEmployees,
        total_synced: totalSynced,
        orders_updated: ordersUpdatedTotal,
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