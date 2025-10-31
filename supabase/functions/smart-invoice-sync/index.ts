import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  mode?: 'smart' | 'comprehensive' | 'specific_employee';
  sync_invoices?: boolean;
  sync_orders?: boolean;
  force_refresh?: boolean;
  employee_id?: string;
  visible_order_ids?: string[];
  partner?: 'alwaseet' | 'modon';
}

interface ProxyRequest {
  endpoint: string;
  method: string;
  token: string;
  payload?: any;
  queryParams?: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SyncRequest = await req.json();
    const {
      mode = 'smart',
      sync_invoices = true,
      sync_orders = true,
      force_refresh = false,
      employee_id,
      visible_order_ids,
      partner
    } = body;

    console.log(`🔄 Smart Invoice Sync started - Mode: ${mode}, User: ${user.id}`);

    let invoices_synced = 0;
    let orders_updated = 0;
    const errors: string[] = [];

    // Get active delivery partner tokens for this user
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('delivery_partner_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (tokensError || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No active delivery partner tokens found',
          invoices_synced: 0,
          orders_updated: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter tokens by partner if specified
    const activeTokens = partner 
      ? tokens.filter(t => t.partner_name === partner)
      : tokens;

    if (activeTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: `No active tokens for partner: ${partner}`,
          invoices_synced: 0,
          orders_updated: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each active partner token
    for (const tokenData of activeTokens) {
      const partnerName = tokenData.partner_name;
      const proxyFunction = partnerName === 'modon' ? 'modon-proxy' : 'alwaseet-proxy';
      
      console.log(`🔄 Syncing for partner: ${partnerName}`);

      try {
        // Sync Invoices
        if (sync_invoices) {
          console.log(`📄 Fetching invoices from ${partnerName}...`);
          
          const invoiceRequest: ProxyRequest = {
            endpoint: 'merchant/invoices',
            method: 'GET',
            token: tokenData.token
          };

          const { data: invoicesResponse, error: invoicesError } = await supabaseClient.functions.invoke(
            proxyFunction,
            { body: invoiceRequest }
          );

          if (invoicesError) {
            console.error(`❌ Error fetching invoices from ${partnerName}:`, invoicesError);
            errors.push(`${partnerName} invoices: ${invoicesError.message}`);
          } else if (invoicesResponse?.data) {
            const invoices = Array.isArray(invoicesResponse.data) ? invoicesResponse.data : [];
            console.log(`📄 Found ${invoices.length} invoices from ${partnerName}`);

            // Save invoices to database
            if (invoices.length > 0) {
              const { data: upsertResult, error: upsertError } = await supabaseClient
                .rpc('upsert_delivery_invoices', {
                  p_invoices: invoices.map((inv: any) => ({
                    partner_name: partnerName,
                    invoice_id: inv.id?.toString() || inv.invoice_id?.toString(),
                    invoice_number: inv.invoice_number || inv.id?.toString(),
                    invoice_date: inv.created_at || inv.invoice_date || new Date().toISOString(),
                    total_amount: parseFloat(inv.total_amount || inv.amount || 0),
                    status: inv.status || 'pending',
                    orders_count: parseInt(inv.orders_count || inv.count || 0),
                    raw_data: inv,
                    user_id: user.id
                  }))
                });

              if (upsertError) {
                console.error(`❌ Error upserting invoices for ${partnerName}:`, upsertError);
                errors.push(`${partnerName} upsert: ${upsertError.message}`);
              } else {
                invoices_synced += invoices.length;
                console.log(`✅ Synced ${invoices.length} invoices from ${partnerName}`);
              }
            }
          }
        }

        // Sync Orders
        if (sync_orders) {
          console.log(`📦 Fetching orders from ${partnerName}...`);

          // If visible_order_ids provided, sync only those
          if (visible_order_ids && visible_order_ids.length > 0) {
            console.log(`📦 Syncing ${visible_order_ids.length} visible orders from ${partnerName}...`);
            
            for (const orderId of visible_order_ids) {
              try {
                const orderRequest: ProxyRequest = {
                  endpoint: `merchant/orders/${orderId}`,
                  method: 'GET',
                  token: tokenData.token
                };

                const { data: orderResponse, error: orderError } = await supabaseClient.functions.invoke(
                  proxyFunction,
                  { body: orderRequest }
                );

                if (!orderError && orderResponse?.data) {
                  // Update order in database
                  const orderData = orderResponse.data;
                  const { error: updateError } = await supabaseClient
                    .from('orders')
                    .update({
                      status: orderData.status,
                      delivery_status: orderData.delivery_status || orderData.status,
                      last_synced_at: new Date().toISOString(),
                      api_response: orderData
                    })
                    .eq('tracking_number', orderData.qr_id || orderData.tracking_number)
                    .eq('created_by', user.id);

                  if (!updateError) {
                    orders_updated++;
                  }
                }
              } catch (err) {
                console.error(`Error syncing order ${orderId}:`, err);
              }
            }
          } else {
            // Sync all orders (comprehensive mode)
            const ordersRequest: ProxyRequest = {
              endpoint: 'merchant/orders',
              method: 'GET',
              token: tokenData.token
            };

            const { data: ordersResponse, error: ordersError } = await supabaseClient.functions.invoke(
              proxyFunction,
              { body: ordersRequest }
            );

            if (ordersError) {
              console.error(`❌ Error fetching orders from ${partnerName}:`, ordersError);
              errors.push(`${partnerName} orders: ${ordersError.message}`);
            } else if (ordersResponse?.data) {
              const orders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
              console.log(`📦 Found ${orders.length} orders from ${partnerName}`);

              // Update each order in database
              for (const orderData of orders) {
                try {
                  const trackingNumber = orderData.qr_id || orderData.tracking_number;
                  if (!trackingNumber) continue;

                  const { error: updateError } = await supabaseClient
                    .from('orders')
                    .update({
                      status: orderData.status,
                      delivery_status: orderData.delivery_status || orderData.status,
                      last_synced_at: new Date().toISOString(),
                      api_response: orderData
                    })
                    .eq('tracking_number', trackingNumber)
                    .eq('created_by', user.id);

                  if (!updateError) {
                    orders_updated++;
                  }
                } catch (err) {
                  console.error(`Error updating order:`, err);
                }
              }

              console.log(`✅ Updated ${orders_updated} orders from ${partnerName}`);
            }
          }
        }

      } catch (error) {
        console.error(`❌ Error syncing ${partnerName}:`, error);
        errors.push(`${partnerName}: ${error.message}`);
      }
    }

    console.log(`✅ Sync completed - Invoices: ${invoices_synced}, Orders: ${orders_updated}`);

    return new Response(
      JSON.stringify({
        success: true,
        invoices_synced,
        orders_updated,
        mode,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Smart Invoice Sync error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        invoices_synced: 0,
        orders_updated: 0
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
