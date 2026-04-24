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

    // ⏳ انتظار قصير لإتاحة الفرصة لتحديث source بعد INSERT (مثلاً من ai-gemini-chat)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 🔄 قراءة source الفعلي من قاعدة البيانات (وليس من payload)
    const { data: freshRow } = await supabase
      .from('ai_orders')
      .select('source')
      .eq('id', record.id)
      .maybeSingle();
    if (freshRow?.source) {
      record.source = freshRow.source;
    }

    // جلب اسم المنشئ
    const { data: creator } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', record.created_by)
      .single();

    const creatorName = creator?.full_name || 'مستخدم';

    // 🏷️ تمييز المصدر (ai_assistant vs telegram vs غيرها)
    const isAiAssistant = record.source === 'ai_assistant' || record.source === 'ai_chat';
    const sourceLabel = isAiAssistant ? 'المساعد الذكي' : (record.source === 'telegram' ? 'تليغرام' : 'النظام');
    const sourceEmoji = isAiAssistant ? '🤖' : (record.source === 'telegram' ? '📨' : '📋');

    // 🔔 إشعار واحد فقط لكل طلب ذكي (موحّد للمدير العام والمنشئ)
    // العنوان يحمل اسم المنشئ والمصدر، والرسالة تحمل اسم العميل والمبلغ.
    // الحارس الفريد في قاعدة البيانات (uniq_new_ai_order_per_user) يمنع التكرار.
    const unifiedNotification = {
      type: 'new_ai_order',
      title: `${sourceEmoji} طلب ذكي جديد من ${creatorName} (${sourceLabel})`,
      message: `عميل: ${record.customer_name || 'غير محدد'} - المبلغ: ${record.total_amount}`,
      user_id: null, // إشعار عام يصل للمدير + يصل للمنشئ عبر فلترة العميل
      data: {
        ai_order_id: record.id,
        customer_name: record.customer_name,
        total_amount: record.total_amount,
        creator_name: creatorName,
        created_by: record.created_by,
        source: record.source
      },
      priority: 'high',
      is_read: false
    };

    // upsert على أساس (ai_order_id) لمنع أي تكرار حتى لو أُعيد استدعاء الـ webhook
    const { error } = await supabase
      .from('notifications')
      .insert(unifiedNotification);

    if (error) {
      // لو كان الخطأ بسبب التكرار (unique violation 23505) نتجاهله بهدوء
      const code = (error as any)?.code;
      if (code === '23505') {
        console.log('ℹ️ Notification already exists for this ai_order, skipped');
      } else {
        console.error('❌ Error saving notification:', error);
        return new Response('Error saving notification', { status: 500, headers: corsHeaders });
      }
    }

    console.log('✅ Single unified notification saved successfully');

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