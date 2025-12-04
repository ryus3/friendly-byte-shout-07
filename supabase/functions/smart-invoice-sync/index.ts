import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ CORRECT AlWaseet API Base URL
const ALWASEET_API_BASE = 'https://api.alwaseet-iq.net/v1/merchant';

interface SyncRequest {
  mode: 'smart' | 'comprehensive';
  employee_id?: string;
  sync_invoices?: boolean;
  sync_orders?: boolean;
  force_refresh?: boolean;
}

interface Invoice {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  orders_count?: number;
  received?: boolean;
  [key: string]: any;
}

interface InvoiceOrder {
  id: number;
  price?: number;
  status?: string;
  [key: string]: any;
}

// Fetch invoices from AlWaseet API
async function fetchInvoicesFromAPI(token: string): Promise<Invoice[]> {
  try {
    console.log('📡 Fetching invoices from AlWaseet API...');
    const response = await fetch(`${ALWASEET_API_BASE}/merchant-invoices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    console.log(`📥 API Response: success=${data.success}, count=${data.data?.length || 0}`);
    
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

// Fetch invoice orders from AlWaseet API
async function fetchInvoiceOrdersFromAPI(token: string, invoiceId: string): Promise<InvoiceOrder[]> {
  try {
    const response = await fetch(`${ALWASEET_API_BASE}/invoice-orders?invoiceId=${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API Error fetching orders for invoice ${invoiceId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    
    // Handle different response structures
    if (Array.isArray(data.orders)) {
      return data.orders;
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching orders for invoice ${invoiceId}:`, error);
    return [];
  }
}

// Normalize invoice status
function normalizeStatus(status: string | null): string {
  if (!status) return 'pending';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('receiv') || statusLower.includes('مستلم')) return 'received';
  if (statusLower.includes('pend') || statusLower.includes('معلق')) return 'pending';
  return statusLower;
}

serve(async (req) => {
  // Handle CORS preflight
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
      force_refresh = false 
    } = body;

    console.log(`🔄 Smart Invoice Sync - Mode: ${mode}, Employee: ${employee_id || 'all'}, SyncOrders: ${sync_orders}`);

    let totalInvoicesSynced = 0;
    let totalOrdersUpdated = 0;
    const employeeResults: Record<string, { invoices: number; orders: number }> = {};

    if (mode === 'comprehensive') {
      // ========== COMPREHENSIVE MODE ==========
      // Fetch ALL active employee tokens and sync their invoices
      
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

      // Process each employee's token
      for (const tokenData of tokens || []) {
        const employeeId = tokenData.user_id;
        const accountUsername = tokenData.account_username || 'unknown';
        
        console.log(`👤 Syncing invoices for employee: ${employeeId} (${accountUsername})`);

        try {
          // Fetch invoices from AlWaseet API
          const apiInvoices = await fetchInvoicesFromAPI(tokenData.token);
          console.log(`  📥 Fetched ${apiInvoices.length} invoices from API`);

          let employeeInvoicesSynced = 0;
          let employeeOrdersSynced = 0;

          for (const invoice of apiInvoices) {
            const externalId = String(invoice.id);
            const statusNormalized = normalizeStatus(invoice.status);
            const isReceived = statusNormalized === 'received' || invoice.received === true;

            // Upsert invoice with correct owner_user_id
            const { data: upsertedInvoice, error: upsertError } = await supabase
              .from('delivery_invoices')
              .upsert({
                external_id: externalId,
                partner: 'alwaseet',
                owner_user_id: employeeId,
                account_username: accountUsername,
                merchant_id: tokenData.merchant_id,
                amount: invoice.amount || 0,
                orders_count: invoice.orders_count || invoice.ordersCount || 0,
                status: invoice.status,
                status_normalized: statusNormalized,
                received: isReceived,
                received_flag: isReceived,
                issued_at: invoice.created_at || invoice.createdAt,
                raw: invoice,
                last_synced_at: new Date().toISOString(),
                last_api_updated_at: new Date().toISOString(),
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
              
              // ✅ Sync invoice orders if requested
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
                    
                    // Update orders_last_synced_at
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

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Update last_used_at for all processed tokens
      if (tokens && tokens.length > 0) {
        await supabase
          .from('delivery_partner_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .in('id', tokens.map(t => t.id));
      }

    } else {
      // ========== SMART MODE ==========
      // Quick sync for specific employee or current user
      
      let targetEmployeeId = employee_id;

      // If no employee_id provided, get from auth header
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

      // Get employee's token
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

      // Fetch recent invoices
      const apiInvoices = await fetchInvoicesFromAPI(tokenData.token);
      
      // In smart mode, only process last 5 invoices for speed
      const recentInvoices = force_refresh ? apiInvoices : apiInvoices.slice(0, 5);
      
      console.log(`📥 Processing ${recentInvoices.length} recent invoices (smart mode)`);

      for (const invoice of recentInvoices) {
        const externalId = String(invoice.id);
        const statusNormalized = normalizeStatus(invoice.status);
        const isReceived = statusNormalized === 'received' || invoice.received === true;

        // Check if invoice already exists with same status
        if (!force_refresh) {
          const { data: existing } = await supabase
            .from('delivery_invoices')
            .select('id, status_normalized, received')
            .eq('external_id', externalId)
            .eq('partner', 'alwaseet')
            .single();

          // Skip if no changes
          if (existing && existing.status_normalized === statusNormalized && existing.received === isReceived) {
            continue;
          }
        }

        const { data: upsertedInvoice, error: upsertError } = await supabase
          .from('delivery_invoices')
          .upsert({
            external_id: externalId,
            partner: 'alwaseet',
            owner_user_id: targetEmployeeId,
            account_username: tokenData.account_username,
            merchant_id: tokenData.merchant_id,
            amount: invoice.amount || 0,
            orders_count: invoice.orders_count || invoice.ordersCount || 0,
            status: invoice.status,
            status_normalized: statusNormalized,
            received: isReceived,
            received_flag: isReceived,
            issued_at: invoice.created_at || invoice.createdAt,
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
          
          // ✅ Sync orders in smart mode too if requested
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

    // Log sync result
    await supabase.from('background_sync_logs').insert({
      sync_type: mode === 'comprehensive' ? 'comprehensive_invoice_sync' : 'smart_invoice_sync',
      success: true,
      invoices_synced: totalInvoicesSynced,
      orders_updated: totalOrdersUpdated,
    });

    console.log(`✅ Sync complete - Invoices: ${totalInvoicesSynced}, Orders: ${totalOrdersUpdated}`);

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        invoices_synced: totalInvoicesSynced,
        orders_updated: totalOrdersUpdated,
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
