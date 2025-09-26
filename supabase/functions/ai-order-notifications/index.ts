import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔔 AI Order Notifications Edge Function called');

  try {
    const supabase = createClient(
      'https://tkheostkubborwkwzugl.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { type, record } = await req.json();
    console.log('📦 Received webhook data:', { type, record: record?.id });

    if (type !== 'ai_order_created' || !record) {
      console.log('❌ Invalid webhook data');
      return new Response('Invalid webhook data', { status: 400, headers: corsHeaders });
    }

    console.log('🆕 Processing new AI order:', record.id);

    // جلب بيانات المنشئ
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', record.created_by)
      .single();

    const creatorName = creatorProfile?.full_name || 'مستخدم غير معروف';
    console.log('👤 Creator:', creatorName);

    // إنشاء الإشعارات
    const notifications = [];

    // إشعار للمنشئ
    notifications.push({
      type: 'new_ai_order',
      title: '✅ تم إنشاء طلب ذكي جديد',
      message: `تم حفظ طلبك الذكي بنجاح - في انتظار اختيار شركة التوصيل`,
      user_id: record.created_by,
      data: {
        ai_order_id: record.id,
        customer_name: record.customer_name,
        total_amount: record.total_amount,
        source: record.source
      },
      priority: 'high',
      is_read: false
    });

    // إشعار للمديرين (إذا لم يكن المنشئ مديراً)
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin']);

    if (adminProfiles) {
      for (const admin of adminProfiles) {
        if (admin.id !== record.created_by) {
          notifications.push({
            type: 'new_ai_order',
            title: `📋 طلب ذكي جديد من ${creatorName}`,
            message: `عميل: ${record.customer_name || 'غير محدد'} - المبلغ: ${record.total_amount || 0}`,
            user_id: admin.id,
            data: {
              ai_order_id: record.id,
              customer_name: record.customer_name,
              total_amount: record.total_amount,
              creator_name: creatorName,
              created_by: record.created_by,
              source: record.source
            },
            priority: 'medium',
            is_read: false
          });
        }
      }
    }

    // إشعار عام للمديرين
    notifications.push({
      type: 'new_ai_order',
      title: `📋 طلب ذكي جديد من ${creatorName}`,
      message: `عميل: ${record.customer_name || 'غير محدد'} - المبلغ: ${record.total_amount || 0}`,
      user_id: null, // إشعار عام
      data: {
        ai_order_id: record.id,
        customer_name: record.customer_name,
        total_amount: record.total_amount,
        creator_name: creatorName,
        created_by: record.created_by,
        source: record.source
      },
      priority: 'medium',
      is_read: false
    });

    console.log('💾 Saving notifications to database:', notifications.length);

    // حفظ الإشعارات في قاعدة البيانات
    const { data: savedNotifications, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) {
      console.error('❌ Error saving notifications:', error);
      return new Response('Error saving notifications', { status: 500, headers: corsHeaders });
    }

    console.log('✅ Notifications saved successfully:', savedNotifications?.length);

    console.log('🚀 AI Order notification process completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      notifications_created: notifications.length,
      ai_order_id: record.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in AI Order notifications:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});