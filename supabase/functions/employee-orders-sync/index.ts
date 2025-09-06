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
    const { employee_id } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 مزامنة طلبات الموظف: ${employee_id}`);

    // استدعاء دالة المزامنة التلقائية للموظف المحدد
    const { data: syncResult, error: syncError } = await supabase.rpc('sync_employee_orders', {
      p_employee_id: employee_id
    });

    if (syncError) {
      throw new Error(`خطأ في مزامنة طلبات الموظف: ${syncError.message}`);
    }

    // تسجيل نتائج المزامنة
    await supabase
      .from('auto_sync_log')
      .insert({
        sync_type: 'employee_manual',
        triggered_by: employee_id,
        employees_processed: 1,
        orders_updated: syncResult?.orders_updated || 0,
        success: !syncError,
        error_message: syncError?.message || null,
        results: JSON.stringify(syncResult || {}),
        completed_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: syncResult?.message || `تمت مزامنة طلبات الموظف بنجاح`,
        orders_updated: syncResult?.orders_updated || 0,
        total_orders: syncResult?.total_orders || 0,
        sync_timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ في مزامنة طلبات الموظف:', error);
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