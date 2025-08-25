import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MarkInvoiceRequest {
  orderIds: string[];
  invoiceId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { orderIds, invoiceId }: MarkInvoiceRequest = await req.json();

    console.log(`Processing invoice ${invoiceId} for ${orderIds.length} orders`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each order individually with improved logic
    for (const orderId of orderIds) {
      let retryCount = 0;
      let success = false;

      while (retryCount < 3 && !success) {
        try {
          // First check current state to avoid conflicts
          const { data: currentOrder, error: checkError } = await supabaseClient
            .from('orders')
            .select('id, order_number, receipt_received, status, delivery_partner_order_id')
            .eq('id', orderId)
            .single();

          if (checkError) {
            console.error(`Error checking order ${orderId}:`, checkError.message);
            throw checkError;
          }

          if (!currentOrder) {
            console.log(`Order ${orderId} not found`);
            results.push({
              orderId,
              success: true,
              updated: false,
              reason: 'Order not found'
            });
            success = true;
            continue;
          }

          if (currentOrder.receipt_received === true) {
            console.log(`Order ${currentOrder.order_number} already marked as invoice received`);
            results.push({
              orderId,
              orderNumber: currentOrder.order_number,
              success: true,
              updated: false,
              reason: 'Already received'
            });
            success = true;
            continue;
          }

          // Only update if order is delivered and invoice not yet received
          const isValidForUpdate = ['delivered', 'completed'].includes(currentOrder.status) && 
                                   currentOrder.receipt_received === false;

          if (!isValidForUpdate) {
            console.log(`Order ${currentOrder.order_number} not in valid state for invoice receipt (status: ${currentOrder.status})`);
            results.push({
              orderId,
              orderNumber: currentOrder.order_number,
              success: true,
              updated: false,
              reason: `Not delivered yet (status: ${currentOrder.status})`
            });
            success = true;
            continue;
          }

          // Perform the update with precise conditions
          const { data, error } = await supabaseClient
            .from('orders')
            .update({
              receipt_received: true,
              receipt_received_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .eq('receipt_received', false)
            .in('status', ['delivered', 'completed'])
            .select('id, order_number, status');

          if (error) throw error;

          if (data && data.length > 0) {
            console.log(`Successfully marked order ${data[0].order_number} (${data[0].status}) as invoice received`);
            results.push({
              orderId,
              orderNumber: data[0].order_number,
              success: true,
              updated: true,
              status: data[0].status
            });
            successCount++;
          } else {
            console.log(`Order ${currentOrder.order_number} update returned no rows - may have been updated by another process`);
            results.push({
              orderId,
              orderNumber: currentOrder.order_number,
              success: true,
              updated: false,
              reason: 'No update needed or concurrent modification'
            });
          }
          
          success = true;

        } catch (error) {
          retryCount++;
          console.error(`Attempt ${retryCount} failed for order ${orderId}:`, error.message);
          
          // Handle specific PostgreSQL errors
          if (error.message.includes('tuple to be updated was already modified')) {
            console.log(`Order ${orderId} was modified by another operation, will retry...`);
            if (retryCount < 3) {
              // Exponential backoff for trigger conflicts
              await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
              continue;
            }
          }
          
          if (retryCount >= 3) {
            results.push({
              orderId,
              success: false,
              error: error.message,
              errorType: error.message.includes('tuple to be updated') ? 'concurrent_modification' : 'other'
            });
            errorCount++;
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
          }
        }
      }
    }

    console.log(`Completed processing: ${successCount} successful, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: orderIds.length,
          successful: successCount,
          failed: errorCount,
          invoiceId
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})