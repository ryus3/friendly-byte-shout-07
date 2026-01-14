import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ CORRECT AlWaseet API Base URL
const ALWASEET_API_BASE = 'https://api.alwaseet-iq.net/v1/merchant';

interface SyncRequest {
  mode: 'smart' | 'comprehensive' | 'refresh_pending' | 'repair_invoice';
  employee_id?: string;
  sync_invoices?: boolean;
  sync_orders?: boolean;
  force_refresh?: boolean;
  run_reconciliation?: boolean;
  invoice_id?: string; // ✅ NEW: لإصلاح فاتورة محددة
}

interface Invoice {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  updated_at?: string;
  orders_count?: number;
  delivered_orders_count?: number;
  received?: boolean;
  merchant_price?: number;
  [key: string]: any;
}

interface InvoiceOrder {
  id: number;
  price?: number;
  status?: string;
  [key: string]: any;
}

// ✅ Fetch invoices from AlWaseet API - CORRECTED endpoint
async function fetchInvoicesFromAPI(token: string): Promise<Invoice[]> {
  try {
    console.log('📡 Fetching invoices from AlWaseet API...');
    const response = await fetch(`${ALWASEET_API_BASE}/get_merchant_invoices?token=${encodeURIComponent(token)}`, {
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
    const count = Array.isArray(data?.data) ? data.data.length : (Array.isArray(data) ? data.length : 0);
    console.log(`📥 API Response: status=${data?.status}, errNum=${data?.errNum}, count=${count}`);

    if (ok && Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data)) {
      return data;
    }

    console.warn('⚠️ Unexpected invoices response shape:', JSON.stringify(data)?.slice(0, 500));
    return [];
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

// ✅ Fetch invoice orders from AlWaseet API - CORRECTED endpoint
async function fetchInvoiceOrdersFromAPI(token: string, invoiceId: string): Promise<InvoiceOrder[]> {
  try {
    console.log(`📡 Fetching orders for invoice ${invoiceId}...`);
    const response = await fetch(`${ALWASEET_API_BASE}/get_merchant_invoice_orders?token=${encodeURIComponent(token)}&invoice_id=${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error fetching orders for invoice ${invoiceId}: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const ok = data?.status === true || data?.errNum === 'S000';

    if (ok && data?.data && typeof data.data === 'object') {
      if (Array.isArray(data.data.orders)) {
        console.log(`📥 Invoice ${invoiceId} orders: ${data.data.orders.length} (from data.data.orders)`);
        return data.data.orders;
      }
      if (Array.isArray(data.data)) {
        console.log(`📥 Invoice ${invoiceId} orders: ${data.data.length} (from data.data array)`);
        return data.data;
      }
    }

    if (ok && Array.isArray(data?.orders)) {
      console.log(`📥 Invoice ${invoiceId} orders: ${data.orders.length} (from data.orders)`);
      return data.orders;
    }

    if (Array.isArray(data)) {
      console.log(`📥 Invoice ${invoiceId} orders: ${data.length} (from root array)`);
      return data;
    }

    console.warn(`⚠️ No orders found for invoice ${invoiceId}. Response shape:`, JSON.stringify(data)?.slice(0, 500));
    return [];
  } catch (error) {
    console.error(`Error fetching orders for invoice ${invoiceId}:`, error);
    return [];
  }
}

/**
 * ✅ تطبيع حالة الفاتورة مع التفريق بين المندوب والتاجر
 */
function normalizeStatus(status: string | null): string {
  if (!status) return 'pending';
  const statusLower = status.toLowerCase();
  const statusOriginal = status;
  
  if (statusOriginal.includes('المندوب') || statusOriginal.includes('مندوب')) {
    console.log(`📋 Status "${status}" → pending (delegate received, not merchant)`);
    return 'pending';
  }
  
  if (statusOriginal.includes('التاجر') || statusOriginal.includes('تاجر')) {
    console.log(`📋 Status "${status}" → received (merchant received)`);
    return 'received';
  }
  
  if (statusOriginal.includes('تم الاستلام') || statusOriginal.includes('تم استلام')) {
    console.log(`📋 Status "${status}" → received (generic received)`);
    return 'received';
  }
  
  if (statusOriginal.includes('مستلم')) {
    console.log(`📋 Status "${status}" → received (contains "مستلم")`);
    return 'received';
  }
  
  if (statusLower.includes('receiv')) {
    console.log(`📋 Status "${status}" → received (English)`);
    return 'received';
  }
  
  if (statusLower.includes('pend') || statusOriginal.includes('معلق') || statusOriginal.includes('انتظار')) {
    console.log(`📋 Status "${status}" → pending`);
    return 'pending';
  }
  
  if (statusLower.includes('cancel') || statusOriginal.includes('ملغ')) {
    console.log(`📋 Status "${status}" → cancelled`);
    return 'cancelled';
  }
  
  if (statusLower.includes('sent') || statusOriginal.includes('ارسال') || statusOriginal.includes('أرسل') || statusOriginal.includes('تصدير')) {
    console.log(`📋 Status "${status}" → sent`);
    return 'sent';
  }
  
  console.log(`📋 Status "${status}" → pending (default/unknown)`);
  return 'pending';
}

/**
 * ✅ استخراج تاريخ الاستلام الحقيقي من بيانات الفاتورة
 */
function extractReceivedAt(invoice: Invoice): string | null {
  if (invoice.updated_at) {
    return invoice.updated_at;
  }
  if (invoice.created_at) {
    return invoice.created_at;
  }
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
      sync_orders = false,
      force_refresh = false,
      run_reconciliation = true,
      invoice_id // ✅ NEW parameter
    } = body;

    console.log(`🔄 Smart Invoice Sync - Mode: ${mode}, Employee: ${employee_id || 'all'}, InvoiceId: ${invoice_id || 'none'}, SyncOrders: ${sync_orders}, Reconcile: ${run_reconciliation}`);

    let totalInvoicesSynced = 0;
    let totalOrdersUpdated = 0;
    const employeeResults: Record<string, { invoices: number; orders: number }> = {};

    // ========== REPAIR INVOICE MODE ==========
    // ✅ NEW: إصلاح فاتورة محددة بجلب طلباتها وربطها
    if (mode === 'repair_invoice' && invoice_id) {
      console.log(`🔧 REPAIR INVOICE MODE - Fixing invoice ${invoice_id}...`);
      
      // جلب معلومات الفاتورة
      const { data: invoice, error: invoiceError } = await supabase
        .from('delivery_invoices')
        .select('id, external_id, owner_user_id, orders_count, received, status_normalized')
        .eq('external_id', invoice_id)
        .eq('partner', 'alwaseet')
        .single();

      if (invoiceError || !invoice) {
        console.error(`❌ Invoice ${invoice_id} not found:`, invoiceError?.message);
        return new Response(
          JSON.stringify({ success: false, error: `Invoice ${invoice_id} not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`📋 Found invoice: id=${invoice.id}, owner=${invoice.owner_user_id}, expected_orders=${invoice.orders_count}`);

      // جلب token الخاص بمالك الفاتورة
      const { data: tokenData, error: tokenError } = await supabase
        .from('delivery_partner_tokens')
        .select('token, account_username')
        .eq('user_id', invoice.owner_user_id)
        .eq('is_active', true)
        .eq('partner_name', 'alwaseet')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        console.error(`❌ No active token for invoice owner:`, tokenError?.message);
        return new Response(
          JSON.stringify({ success: false, error: 'No active token for invoice owner' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // جلب طلبات الفاتورة من API
      const invoiceOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, invoice_id);
      console.log(`📦 Fetched ${invoiceOrders.length} orders from API for invoice ${invoice_id}`);

      // إدخال/تحديث طلبات الفاتورة
      let ordersInserted = 0;
      for (const order of invoiceOrders) {
        const { error: orderError } = await supabase
          .from('delivery_invoice_orders')
          .upsert({
            invoice_id: invoice.id,
            external_order_id: String(order.id),
            raw: order,
            status: order.status,
            amount: order.price || order.amount || 0,
            owner_user_id: invoice.owner_user_id,
          }, {
            onConflict: 'invoice_id,external_order_id',
            ignoreDuplicates: false,
          });
        
        if (!orderError) {
          ordersInserted++;
        }
      }

      // تحديث orders_last_synced_at
      await supabase
        .from('delivery_invoices')
        .update({ 
          orders_last_synced_at: new Date().toISOString(),
          orders_count: invoiceOrders.length || invoice.orders_count
        })
        .eq('id', invoice.id);

      // تشغيل الربط والتسوية
      let linkedCount = 0;
      let updatedOrdersCount = 0;
      try {
        const { data: linkResult } = await supabase.rpc('link_invoice_orders_to_orders');
        if (linkResult && linkResult.length > 0) {
          linkedCount = linkResult[0].linked_count || 0;
          updatedOrdersCount = linkResult[0].updated_orders_count || 0;
        }
      } catch (e) {
        console.warn('⚠️ Error linking:', e);
      }

      // تسوية receipt_received
      let reconciledCount = 0;
      try {
        const { data: reconciledOrders } = await supabase.rpc('reconcile_invoice_receipts');
        reconciledCount = reconciledOrders?.[0]?.reconciled_count || 0;
      } catch (e) {
        console.warn('⚠️ Error reconciling:', e);
      }

      console.log(`✅ REPAIR COMPLETE: invoice=${invoice_id}, orders_fetched=${invoiceOrders.length}, inserted=${ordersInserted}, linked=${linkedCount}, reconciled=${reconciledCount}`);

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id,
          orders_fetched: invoiceOrders.length,
          orders_inserted: ordersInserted,
          linked_count: linkedCount,
          updated_orders_count: updatedOrdersCount,
          reconciled_count: reconciledCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== REFRESH PENDING MODE ==========
    if (mode === 'refresh_pending') {
      console.log('🔄 REFRESH PENDING MODE - Checking stale pending invoices...');
      
      const { data: tokens, error: tokensError } = await supabase
        .from('delivery_partner_tokens')
        .select('id, user_id, token, account_username, merchant_id, expires_at')
        .eq('is_active', true)
        .eq('partner_name', 'alwaseet')
        .gt('expires_at', new Date().toISOString());

      if (tokensError) {
        throw new Error('Failed to fetch employee tokens');
      }

      console.log(`📋 Found ${tokens?.length || 0} active tokens`);

      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data: pendingInvoices, error: pendingError } = await supabase
        .from('delivery_invoices')
        .select('id, external_id, owner_user_id, status, status_normalized, received, last_synced_at')
        .eq('partner', 'alwaseet')
        .eq('received', false)
        .gt('issued_at', sixtyDaysAgo)
        .order('issued_at', { ascending: false });

      if (pendingError) {
        console.error('Error fetching pending invoices:', pendingError);
        throw new Error('Failed to fetch pending invoices');
      }

      console.log(`📋 Found ${pendingInvoices?.length || 0} pending invoices to check`);

      const invoicesByOwner = new Map<string, typeof pendingInvoices>();
      for (const inv of pendingInvoices || []) {
        if (!inv.owner_user_id) continue;
        const existing = invoicesByOwner.get(inv.owner_user_id) || [];
        existing.push(inv);
        invoicesByOwner.set(inv.owner_user_id, existing);
      }

      for (const tokenData of tokens || []) {
        const employeeId = tokenData.user_id;
        const ownerPendingInvoices = invoicesByOwner.get(employeeId) || [];
        
        if (ownerPendingInvoices.length === 0) {
          continue;
        }

        console.log(`👤 Checking ${ownerPendingInvoices.length} pending invoices for ${tokenData.account_username}`);

        try {
          const apiInvoices = await fetchInvoicesFromAPI(tokenData.token);
          
          const apiInvoicesMap = new Map<string, Invoice>();
          for (const inv of apiInvoices) {
            apiInvoicesMap.set(String(inv.id), inv);
          }

          for (const pendingInv of ownerPendingInvoices) {
            const apiInvoice = apiInvoicesMap.get(pendingInv.external_id);
            
            if (!apiInvoice) {
              console.log(`  ⚠️ Invoice ${pendingInv.external_id} not found in API response`);
              continue;
            }

            const apiStatus = normalizeStatus(apiInvoice.status);
            const isNowReceived = apiStatus === 'received';

            if (isNowReceived && !pendingInv.received) {
              console.log(`  📝 Invoice ${pendingInv.external_id} status changed: ${pendingInv.status_normalized} → received`);
              
              const receivedAt = extractReceivedAt(apiInvoice);
              
              const { error: updateError } = await supabase
                .from('delivery_invoices')
                .update({
                  status: apiInvoice.status,
                  status_normalized: 'received',
                  received: true,
                  received_flag: true,
                  received_at: receivedAt,
                  last_synced_at: new Date().toISOString(),
                  last_api_updated_at: apiInvoice.updated_at || new Date().toISOString(),
                  raw: apiInvoice,
                })
                .eq('id', pendingInv.id);

              if (updateError) {
                console.error(`  ❌ Error updating invoice ${pendingInv.external_id}:`, updateError.message);
              } else {
                totalInvoicesSynced++;
                console.log(`  ✅ Invoice ${pendingInv.external_id} marked as received`);
              }
            } else if (apiStatus !== pendingInv.status_normalized) {
              console.log(`  📝 Invoice ${pendingInv.external_id} status update: ${pendingInv.status_normalized} → ${apiStatus}`);
              
              await supabase
                .from('delivery_invoices')
                .update({
                  status: apiInvoice.status,
                  status_normalized: apiStatus,
                  last_synced_at: new Date().toISOString(),
                  raw: apiInvoice,
                })
                .eq('id', pendingInv.id);
            }
          }

          employeeResults[employeeId] = {
            invoices: totalInvoicesSynced,
            orders: 0,
          };

        } catch (employeeError) {
          console.error(`  ❌ Error checking pending invoices for ${tokenData.account_username}:`, employeeError);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log(`\n🔗 Running post-refresh reconciliation...`);

    } else if (mode === 'comprehensive') {
      // ========== COMPREHENSIVE MODE ==========
      
      const { data: tokens, error: tokensError } = await supabase
        .from('delivery_partner_tokens')
        .select('id, user_id, token, account_username, merchant_id, expires_at')
        .eq('is_active', true)
        .eq('partner_name', 'alwaseet')
        .gt('expires_at', new Date().toISOString());

      if (tokensError) {
        console.error('Error fetching tokens:', tokensError);
        throw new Error('Failed to fetch employee tokens');
      }

      console.log(`📋 Found ${tokens?.length || 0} active tokens to sync`);

      for (const tokenData of tokens || []) {
        const employeeId = tokenData.user_id;
        const accountUsername = tokenData.account_username || 'unknown';
        
        console.log(`👤 Syncing invoices for employee: ${employeeId} (${accountUsername})`);

        try {
          const apiInvoices = await fetchInvoicesFromAPI(tokenData.token);
          console.log(`  📥 Fetched ${apiInvoices.length} invoices from API`);

          let employeeInvoicesSynced = 0;
          let employeeOrdersSynced = 0;

          for (const invoice of apiInvoices) {
            const externalId = String(invoice.id);
            const statusNormalized = normalizeStatus(invoice.status);
            const isReceived = statusNormalized === 'received' || invoice.received === true;
            const receivedAt = isReceived ? extractReceivedAt(invoice) : null;
            const apiOrdersCount = invoice.delivered_orders_count || invoice.orders_count || 0;

            const { data: existingInvoice } = await supabase
              .from('delivery_invoices')
              .select('id, received, received_at, status_normalized, orders_last_synced_at, orders_count')
              .eq('external_id', externalId)
              .eq('partner', 'alwaseet')
              .single();

            let existingOrdersCount = 0;
            if (existingInvoice?.id) {
              const { count } = await supabase
                .from('delivery_invoice_orders')
                .select('*', { count: 'exact', head: true })
                .eq('invoice_id', existingInvoice.id);
              existingOrdersCount = count || 0;
            }

            // ✅ FIXED: استخدام DB orders_count كـ fallback إذا API لم يعط قيمة
            const expectedOrdersCount = apiOrdersCount || existingInvoice?.orders_count || 0;
            const needsOrdersSync = sync_orders && expectedOrdersCount > 0 && existingOrdersCount === 0;
            
            if (existingInvoice?.received === true && !force_refresh) {
              if (needsOrdersSync) {
                console.log(`  🔧 Invoice ${externalId} received but missing orders (${expectedOrdersCount} expected, ${existingOrdersCount} found). Syncing orders only...`);
                try {
                  const invoiceOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId);
                  
                  if (invoiceOrders.length > 0) {
                    console.log(`    📦 Self-healing: Syncing ${invoiceOrders.length} orders for invoice ${externalId}`);
                    
                    for (const order of invoiceOrders) {
                      const { error: orderError } = await supabase
                        .from('delivery_invoice_orders')
                        .upsert({
                          invoice_id: existingInvoice.id,
                          external_order_id: String(order.id),
                          raw: order,
                          status: order.status,
                          amount: order.price || order.amount || 0,
                          owner_user_id: employeeId,
                        }, {
                          onConflict: 'invoice_id,external_order_id',
                          ignoreDuplicates: false,
                        });
                      
                      if (!orderError) {
                        employeeOrdersSynced++;
                      }
                    }
                    
                    await supabase
                      .from('delivery_invoices')
                      .update({ orders_last_synced_at: new Date().toISOString() })
                      .eq('id', existingInvoice.id);
                  }
                } catch (ordersError) {
                  console.error(`    ❌ Error self-healing orders for invoice ${externalId}:`, ordersError);
                }
              } else {
                console.log(`  ⏭️ Invoice ${externalId} already received in DB with ${existingOrdersCount} orders, skipping`);
              }
              continue;
            }
            
            const statusChanged = existingInvoice && existingInvoice.status_normalized !== statusNormalized;
            if (statusChanged) {
              console.log(`  📝 Invoice ${externalId} status changed: ${existingInvoice.status_normalized} → ${statusNormalized}`);
            }

            const issuedAtValue = invoice.updated_at || invoice.created_at || invoice.createdAt || new Date().toISOString();
            
            const { data: upsertedInvoice, error: upsertError } = await supabase
              .from('delivery_invoices')
              .upsert({
                external_id: externalId,
                partner: 'alwaseet',
                owner_user_id: employeeId,
                account_username: accountUsername,
                merchant_id: tokenData.merchant_id,
                amount: invoice.merchant_price || invoice.amount || 0,
                orders_count: apiOrdersCount || existingInvoice?.orders_count || 0,
                status: invoice.status,
                status_normalized: statusNormalized,
                received: isReceived,
                received_flag: isReceived,
                received_at: isReceived ? (existingInvoice?.received_at || receivedAt) : null,
                issued_at: issuedAtValue,
                raw: invoice,
                last_synced_at: new Date().toISOString(),
                last_api_updated_at: invoice.updated_at || new Date().toISOString(),
              }, {
                onConflict: 'external_id,partner',
                ignoreDuplicates: false,
              })
              .select('id')
              .single();

            if (upsertError) {
              console.error(`  ❌ Error upserting invoice ${externalId}:`, upsertError.message);
            } else {
              employeeInvoicesSynced++;
              
              if (sync_orders && upsertedInvoice?.id) {
                try {
                  const invoiceOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId);
                  
                  if (invoiceOrders.length > 0) {
                    console.log(`    📦 Syncing ${invoiceOrders.length} orders for invoice ${externalId}`);
                    
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
                      
                      if (!orderError) {
                        employeeOrdersSynced++;
                      }
                    }
                    
                    await supabase
                      .from('delivery_invoices')
                      .update({ orders_last_synced_at: new Date().toISOString() })
                      .eq('id', upsertedInvoice.id);
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
          };
          totalInvoicesSynced += employeeInvoicesSynced;
          totalOrdersUpdated += employeeOrdersSynced;

          console.log(`  ✅ Synced ${employeeInvoicesSynced} invoices, ${employeeOrdersSynced} orders for ${accountUsername}`);

        } catch (employeeError) {
          console.error(`  ❌ Error syncing employee ${employeeId}:`, employeeError);
          employeeResults[employeeId] = { invoices: 0, orders: 0 };
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (tokens && tokens.length > 0) {
        await supabase
          .from('delivery_partner_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .in('id', tokens.map(t => t.id));
      }

    } else {
      // ========== SMART MODE ==========
      
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

      const { data: tokenData, error: tokenError } = await supabase
        .from('delivery_partner_tokens')
        .select('token, account_username, merchant_id')
        .eq('user_id', targetEmployeeId)
        .eq('is_active', true)
        .eq('partner_name', 'alwaseet')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        console.log(`⚠️ No active token for employee ${targetEmployeeId}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            invoices_synced: 0, 
            message: 'No active token found' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const apiInvoices = await fetchInvoicesFromAPI(tokenData.token);
      
      const recentInvoices = force_refresh ? apiInvoices : apiInvoices.slice(0, 20);
      
      console.log(`📥 Processing ${recentInvoices.length} recent invoices (smart mode)`);

      for (const invoice of recentInvoices) {
        const externalId = String(invoice.id);
        const statusNormalized = normalizeStatus(invoice.status);
        const isReceived = statusNormalized === 'received' || invoice.received === true;
        const receivedAt = isReceived ? extractReceivedAt(invoice) : null;
        const apiOrdersCount = invoice.delivered_orders_count || invoice.orders_count || 0;

        const { data: existing } = await supabase
          .from('delivery_invoices')
          .select('id, status_normalized, received, received_at, orders_last_synced_at, orders_count')
          .eq('external_id', externalId)
          .eq('partner', 'alwaseet')
          .single();

        let existingOrdersCount = 0;
        if (existing?.id) {
          const { count } = await supabase
            .from('delivery_invoice_orders')
            .select('*', { count: 'exact', head: true })
            .eq('invoice_id', existing.id);
          existingOrdersCount = count || 0;
        }

        // ✅ FIXED: استخدام DB orders_count كـ fallback
        const expectedOrdersCount = apiOrdersCount || existing?.orders_count || 0;
        const needsOrdersSync = sync_orders && expectedOrdersCount > 0 && existingOrdersCount === 0;

        if (existing?.received === true && !force_refresh) {
          if (needsOrdersSync) {
            console.log(`🔧 Invoice ${externalId} received but missing orders. Self-healing...`);
            try {
              const invoiceOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId);
              
              for (const order of invoiceOrders) {
                const { error: orderError } = await supabase
                  .from('delivery_invoice_orders')
                  .upsert({
                    invoice_id: existing.id,
                    external_order_id: String(order.id),
                    raw: order,
                    status: order.status,
                    amount: order.price || order.amount || 0,
                    owner_user_id: targetEmployeeId,
                  }, {
                    onConflict: 'invoice_id,external_order_id',
                    ignoreDuplicates: false,
                  });
                
                if (!orderError) {
                  totalOrdersUpdated++;
                }
              }
              
              if (invoiceOrders.length > 0) {
                await supabase
                  .from('delivery_invoices')
                  .update({ orders_last_synced_at: new Date().toISOString() })
                  .eq('id', existing.id);
              }
            } catch (ordersError) {
              console.error(`Error self-healing orders for invoice ${externalId}:`, ordersError);
            }
          } else {
            console.log(`⏭️ Invoice ${externalId} already received in DB with ${existingOrdersCount} orders, skipping`);
          }
          continue;
        }

        const statusChanged = existing && existing.status_normalized !== statusNormalized;
        if (statusChanged) {
          console.log(`📝 Invoice ${externalId} status changed: ${existing.status_normalized} → ${statusNormalized}`);
        }

        if (!force_refresh && existing && !statusChanged && existing.received === isReceived && !needsOrdersSync) {
          continue;
        }

        const issuedAtValue = invoice.updated_at || invoice.created_at || invoice.createdAt || new Date().toISOString();
        
        const { data: upsertedInvoice, error: upsertError } = await supabase
          .from('delivery_invoices')
          .upsert({
            external_id: externalId,
            partner: 'alwaseet',
            owner_user_id: targetEmployeeId,
            account_username: tokenData.account_username,
            merchant_id: tokenData.merchant_id,
            amount: invoice.merchant_price || invoice.amount || 0,
            orders_count: apiOrdersCount || existing?.orders_count || 0,
            status: invoice.status,
            status_normalized: statusNormalized,
            received: isReceived,
            received_flag: isReceived,
            received_at: isReceived ? (existing?.received_at || receivedAt) : null,
            issued_at: issuedAtValue,
            raw: invoice,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'external_id,partner',
            ignoreDuplicates: false,
          })
          .select('id')
          .single();

        if (!upsertError) {
          totalInvoicesSynced++;
          
          if (sync_orders && upsertedInvoice?.id) {
            try {
              const invoiceOrders = await fetchInvoiceOrdersFromAPI(tokenData.token, externalId);
              
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
                
                if (!orderError) {
                  totalOrdersUpdated++;
                }
              }
              
              if (invoiceOrders.length > 0) {
                await supabase
                  .from('delivery_invoices')
                  .update({ orders_last_synced_at: new Date().toISOString() })
                  .eq('id', upsertedInvoice.id);
              }
            } catch (ordersError) {
              console.error(`Error syncing orders for invoice ${externalId}:`, ordersError);
            }
          }
        }
      }

      employeeResults[targetEmployeeId] = {
        invoices: totalInvoicesSynced,
        orders: totalOrdersUpdated,
      };
    }

    // ✅ ربط طلبات الفواتير بالطلبات المحلية تلقائياً
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

    // ✅ تسوية التناقضات تلقائياً (Reconciliation)
    let reconciledCount = 0;
    if (run_reconciliation) {
      try {
        const { data: reconciledOrders, error: reconcileError } = await supabase.rpc('reconcile_invoice_receipts');
        
        if (reconcileError) {
          console.warn('⚠️ Error reconciling invoice receipts:', reconcileError.message);
        } else if (reconciledOrders && reconciledOrders.length > 0) {
          reconciledCount = reconciledOrders[0].reconciled_count || 0;
          console.log(`✅ Reconciled ${reconciledCount} orders with received invoices`);
        }
      } catch (reconcileErr) {
        console.warn('⚠️ Error calling reconcile_invoice_receipts:', reconcileErr);
      }
    }

    // Log sync to background_sync_logs
    try {
      await supabase.from('background_sync_logs').insert({
        sync_type: `smart-invoice-sync:${mode}`,
        sync_time: new Date().toISOString(),
        success: true,
        invoices_synced: totalInvoicesSynced,
        orders_updated: totalOrdersUpdated + linkedCount + updatedOrdersCount,
      });
    } catch (e) {
      console.warn('⚠️ Failed to log sync:', e);
    }

    // Dispatch event for UI updates
    console.log(`✅ SYNC COMPLETE: ${totalInvoicesSynced} invoices, ${totalOrdersUpdated} orders, ${linkedCount} linked, ${reconciledCount} reconciled`);

    return new Response(
      JSON.stringify({
        success: true,
        invoices_synced: totalInvoicesSynced,
        orders_updated: totalOrdersUpdated,
        linked_count: linkedCount,
        updated_orders_count: updatedOrdersCount,
        reconciled_count: reconciledCount,
        employee_results: employeeResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Smart Invoice Sync Error:', error);
    
    // Log error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from('background_sync_logs').insert({
        sync_type: 'smart-invoice-sync:error',
        sync_time: new Date().toISOString(),
        success: false,
        error_message: error.message,
      });
    } catch (e) {
      console.warn('⚠️ Failed to log error:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
