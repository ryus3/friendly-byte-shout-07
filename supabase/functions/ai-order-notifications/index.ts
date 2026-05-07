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

    // جلب اسم المنشئ — جرب id ثم user_id (لاختلاف بنية profiles)
    let creatorName = 'مستخدم';
    try {
      const { data: byId } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', record.created_by)
        .maybeSingle();
      let prof = byId;
      if (!prof?.full_name && !prof?.username) {
        const { data: byUserId } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('user_id', record.created_by)
          .maybeSingle();
        if (byUserId) prof = byUserId;
      }
      creatorName = prof?.full_name || prof?.username || 'مستخدم';
    } catch (e) {
      console.warn('⚠️ profile fetch failed', e);
    }

    // 🏷️ تمييز المصدر
    const isAiAssistant = record.source === 'ai_assistant' || record.source === 'ai_chat';
    const sourceLabel = isAiAssistant ? 'المساعد الذكي' : (record.source === 'telegram' ? 'تليغرام' : 'النظام');
    const sourceEmoji = '🤖';

    const title = `${sourceEmoji} طلب ذكي جديد من ${creatorName} (${sourceLabel})`;
    const message = `عميل: ${record.customer_name || 'غير محدد'} — المبلغ: ${Number(record.total_amount || 0).toLocaleString()} د.ع`;
    const data = {
      ai_order_id: record.id,
      customer_name: record.customer_name,
      total_amount: record.total_amount,
      creator_name: creatorName,
      created_by: record.created_by,
      source: record.source,
      icon: 'sparkles'
    };

    // 1) إشعار عام للمدير العام (user_id = null)
    const recipientsAttempted: string[] = [];
    const insertOne = async (user_id: string | null) => {
      const key = String(user_id);
      if (recipientsAttempted.includes(key)) return;
      recipientsAttempted.push(key);
      const { error } = await supabase.from('notifications').insert({
        type: 'new_ai_order',
        title, message, user_id,
        data, priority: 'high', is_read: false
      });
      if (error && (error as any)?.code !== '23505') {
        console.error('❌ Error saving notification for', user_id, error);
      }
    };

    await insertOne(null);

    // 2) إشعارات لمديري قسم الموظف (employee_supervisors)
    try {
      const { data: supervisors } = await supabase
        .from('employee_supervisors')
        .select('supervisor_id')
        .eq('employee_id', record.created_by);
      for (const sup of supervisors || []) {
        if (sup?.supervisor_id) await insertOne(sup.supervisor_id);
      }
    } catch (e) {
      console.warn('⚠️ supervisors fetch failed', e);
    }

    console.log('✅ AI order notifications dispatched to', recipientsAttempted.length, 'recipients');

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