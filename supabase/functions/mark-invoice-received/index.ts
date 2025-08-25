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

    // Process each order individually with retry logic
    for (const orderId of orderIds) {
      let retryCount = 0;
      let success = false;

      while (retryCount < 3 && !success) {
        try {
          const { data, error } = await supabaseClient
            .from('orders')
            .update({
              receipt_received: true,
              receipt_received_at: new Date().toISOString(),
              receipt_received_by: null // Will be set by trigger if needed
            })
            .eq('id', orderId)
            .eq('receipt_received', false) // Only update if not already received
            .select('id, order_number');

          if (error) throw error;

          if (data && data.length > 0) {
            console.log(`Successfully marked order ${data[0].order_number} as invoice received`);
            results.push({
              orderId,
              orderNumber: data[0].order_number,
              success: true,
              updated: true
            });
            successCount++;
          } else {
            console.log(`Order ${orderId} was already marked as received or not found`);
            results.push({
              orderId,
              success: true,
              updated: false,
              reason: 'Already received or not found'
            });
          }
          
          success = true;

        } catch (error) {
          retryCount++;
          console.error(`Attempt ${retryCount} failed for order ${orderId}:`, error.message);
          
          if (retryCount >= 3) {
            results.push({
              orderId,
              success: false,
              error: error.message
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