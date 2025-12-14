import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIOrderRecord {
  id: string;
  created_by: string;
  customer_name: string | null;
  total_amount: number;
  source: string;
}

interface WebhookPayload {
  type: string;
  record: AIOrderRecord;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔔 AI Order Notifications started');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || 'https://tkheostkubborwkwzugl.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const payload: WebhookPayload = await req.json();
    console.log('📦 Processing AI order:', payload.record.id);

    if (payload.type !== 'ai_order_created') {
      return new Response('Invalid type', { status: 400, headers: corsHeaders });
    }

    const record = payload.record;

    // جلب اسم المنشئ
    const { data: creator } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', record.created_by)
      .single();

    const creatorName = creator?.full_name || 'مستخدم';

    // إشعار للمنشئ
    const creatorNotification = {
      type: 'new_ai_order',
      title: '✅ تم إنشاء طلب ذكي جديد',
      message: 'تم حفظ طلبك الذكي بنجاح',
      user_id: record.created_by,
      data: {
        ai_order_id: record.id,
        customer_name: record.customer_name,
        total_amount: record.total_amount
      },
      priority: 'high',
      is_read: false
    };

    // إشعار عام للمديرين
    const adminNotification = {
      type: 'new_ai_order',
      title: `📋 طلب ذكي جديد من ${creatorName}`,
      message: `عميل: ${record.customer_name || 'غير محدد'} - المبلغ: ${record.total_amount}`,
      user_id: null,
      data: {
        ai_order_id: record.id,
        customer_name: record.customer_name,
        total_amount: record.total_amount,
        creator_name: creatorName,
        created_by: record.created_by
      },
      priority: 'medium',
      is_read: false
    };

    // حفظ الإشعارات
    const { error } = await supabase
      .from('notifications')
      .insert([creatorNotification, adminNotification]);

    if (error) {
      console.error('❌ Error saving notifications:', error);
      return new Response('Error saving notifications', { status: 500, headers: corsHeaders });
    }

    console.log('✅ Notifications saved successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      ai_order_id: record.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('❌ Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});