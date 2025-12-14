import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// ⚠️ معطلة - الإشعارات تُدار الآن من الفرونت إند
// useReliableAiOrderNotifications.js هو المصدر الوحيد
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔔 AI Order Notifications - DISABLED (handled by frontend)');

  // لا نفعل شيء - الإشعارات تُنشأ من الفرونت إند فقط
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Notifications handled by frontend hook'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
