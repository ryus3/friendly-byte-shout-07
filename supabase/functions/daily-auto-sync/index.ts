import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔄 بدء المزامنة التلقائية اليومية...');

    // قراءة إعدادات المزامنة
    const { data: settings, error: settingsError } = await supabase
      .from('invoice_sync_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings?.daily_sync_enabled) {
      console.log('⏹️ المزامنة التلقائية غير مفعلة');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'المزامنة التلقائية غير مفعلة' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // تشغيل مزامنة الفواتير الشاملة
    const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-alwaseet-invoices', {
      body: { 
        scheduled: true, 
        force: true, 
        sync_time: 'daily_auto_sync' 
      }
    });

    if (syncError) {
      console.error('❌ فشل في تشغيل المزامنة التلقائية:', syncError.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: syncError.message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('✅ تمت المزامنة التلقائية بنجاح:', syncResult);

    // تنظيف الفواتير القديمة (الاحتفاظ بآخر 10 لكل موظف)
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_delivery_invoices_keep_latest', {
      p_keep_count: settings.keep_invoices_per_employee || 10
    });

    if (cleanupError) {
      console.warn('⚠️ تحذير في تنظيف الفواتير القديمة:', cleanupError.message);
    } else {
      console.log('🧹 تم تنظيف الفواتير القديمة:', cleanupResult);
    }

    return new Response(JSON.stringify({
      success: true,
      sync_result: syncResult,
      cleanup_result: cleanupResult,
      message: 'تمت المزامنة التلقائية وتنظيف الفواتير بنجاح'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ خطأ في المزامنة التلقائية:', error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});