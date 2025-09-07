import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('🚀 Background Sync Function started')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { sync_type = 'orders_tracking' } = await req.json().catch(() => ({}))
    
    console.log(`📥 Starting ${sync_type} sync...`)

    if (sync_type === 'delivery_invoices') {
      // مزامنة الفواتير اليومية
      console.log('🔄 Starting delivery invoices sync...')
      
      const { data: invoiceSyncResult, error: invoiceError } = await supabaseClient.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'comprehensive',
          sync_invoices: true,
          sync_orders: false,
          force_refresh: true
        }
      })

      if (invoiceError) {
        console.error('❌ Invoice sync failed:', invoiceError)
        throw invoiceError
      }

      console.log('✅ Delivery invoices sync completed:', invoiceSyncResult)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          sync_type,
          invoices_synced: invoiceSyncResult?.invoices_synced || 0,
          message: 'Delivery invoices sync completed'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (sync_type === 'orders_tracking') {
      // مزامنة تتبع الطلبات كل 3 ساعات
      console.log('🔄 Starting orders tracking sync...')
      
      const { data: ordersSyncResult, error: ordersError } = await supabaseClient.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          sync_invoices: false,
          sync_orders: true,
          force_refresh: false
        }
      })

      if (ordersError) {
        console.error('❌ Orders sync failed:', ordersError)
        throw ordersError
      }

      console.log('✅ Orders tracking sync completed:', ordersSyncResult)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          sync_type,
          orders_updated: ordersSyncResult?.orders_updated || 0,
          message: 'Orders tracking sync completed'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // نوع مزامنة غير مدعوم
    console.warn('⚠️ Unknown sync type:', sync_type)
    return new Response(
      JSON.stringify({ success: false, error: 'Unknown sync type' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Background sync failed:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Background sync failed'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})