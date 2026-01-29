import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ API Base URLs for both delivery partners
const ALWASEET_API_BASE = 'https://api.alwaseet-iq.net/v1/merchant';
const MODON_API_BASE = 'https://mcht.modon-express.net/v1/merchant';

interface SyncRequest {
  mode: 'smart' | 'comprehensive';
  employee_id?: string;
  sync_invoices?: boolean;
  sync_orders?: boolean;
  force_refresh?: boolean;
  run_reconciliation?: boolean;
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

// ✅ Fetch ALL invoices from API (supports both AlWaseet and MODON)
async function fetchInvoicesFromAPI(token: string, partner: string = 'alwaseet'): Promise<Invoice[]> {
  try {
    const baseUrl = partner === 'modon' ? MODON_API_BASE : ALWASEET_API_BASE;
    console.log(`📡 Fetching invoices from ${partner.toUpperCase()} API...`);
    
    const response = await fetch(`${baseUrl}/get_merchant_invoices?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const ok = data?.status === true || data?.errNum === 'S000';
    const invoices = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    console.log(`📥 ${partner.toUpperCase()} API Response: status=${data?.status}, errNum=${data?.errNum}, count=${invoices.length}`);

    return invoices;
  } catch (error) {
    console.error(`Error fetching invoices from ${partner}:`, error);
    return [];
  }
}

// ✅ Fetch invoice orders from API (supports both AlWaseet and MODON)
async function fetchInvoiceOrdersFromAPI(token: string, invoiceId: string, partner: string = 'alwaseet'): Promise<InvoiceOrder[]> {
  try {
    const baseUrl = partner === 'modon' ? MODON_API_BASE : ALWASEET_API_BASE;
    console.log(`📡 Fetching orders for invoice ${invoiceId} from ${partner.toUpperCase()}...`);
    
    const response = await fetch(`${baseUrl}/get_merchant_invoice_orders?token=${encodeURIComponent(token)}&invoice_id=${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error fetching orders for invoice ${invoiceId} from ${partner}: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const ok = data?.status === true || data?.errNum === 'S000';
    
    if (ok && Array.isArray(data?.data)) return data.data;
    if (ok && Array.isArray(data?.orders)) return data.orders;
    if (Array.isArray(data)) return data;
    
    return [];
  } catch (error) {
    console.error(`Error fetching orders for invoice ${invoiceId} from ${partner}:`, error);
    return [];
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
      run_reconciliation = true
    } = body;

    console.log(`🔄 Smart Invoice Sync - Mode: ${mode}, Employee: ${employee_id || 'all'}, SyncOrders: ${sync_orders}, ForceRefresh: ${force_refresh}`);

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
          const apiInvoices = await fetchInvoicesFromAPI(tokenData.token, partnerName);
          console.log(`  📥 Fetched ${apiInvoices.length} total invoices from ${partnerName.toUpperCase()} API`);

          let employeeInvoicesSynced = 0;
          let employeeOrdersSynced = 0;
          let employeeNewInvoices = 0;

          // ✅ معالجة كل الفواتير من API
          for (const invoice of apiInvoices) {
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

            // ✅ إذا موجودة ومستلمة في DB ولم نطلب force = تخطي
            if (existingInvoice?.received === true && !force_refresh) {
              continue;
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
                issued_at: invoice.created_at,
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
              
              // ✅ مزامنة طلبات الفاتورة - استخدام partnerName
              if (sync_orders && upsertedInvoice?.id) {
                try {
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
        
        // ✅ جلب كل الفواتير من API المناسب للشركة
        const apiInvoices = await fetchInvoicesFromAPI(tokenData.token, partnerName);
        console.log(`📥 Processing ${apiInvoices.length} invoices for ${tokenData.account_username} from ${partnerName.toUpperCase()}`);

        // ✅ معالجة كل الفواتير وليس فقط 5
        for (const invoice of apiInvoices) {
          const externalId = String(invoice.id);
          const statusNormalized = normalizeStatus(invoice.status);
          const isReceived = statusNormalized === 'received' || invoice.received === true;
          const receivedAt = isReceived ? extractReceivedAt(invoice) : null;

          // Check existing - ✅ استخدام partnerName بدلاً من 'alwaseet' الثابت
          const { data: existing } = await supabase
            .from('delivery_invoices')
            .select('id, status_normalized, received, received_at')
            .eq('external_id', externalId)
            .eq('partner', partnerName)
            .maybeSingle();

          // ✅ Skip if already received in DB and not forcing
          if (existing?.received === true && !force_refresh) {
            continue;
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

          // Skip if no changes at all
          if (!force_refresh && existing && !statusChanged && existing.received === isReceived) {
            continue;
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
              issued_at: invoice.created_at,
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
            
            if (sync_orders && upsertedInvoice?.id) {
              try {
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

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
