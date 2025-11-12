import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { orderId } = await req.json();

    // جلب بيانات الطلب
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, created_by')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    // التحقق من صلاحيات الموظف
    const { data: permission } = await supabase
      .from('employee_notification_permissions')
      .select('can_send_whatsapp')
      .eq('user_id', order.created_by)
      .single();

    if (!permission?.can_send_whatsapp) {
      console.log('الموظف ليس لديه صلاحية إرسال إشعارات WhatsApp');
      return new Response(
        JSON.stringify({ success: false, message: 'الموظف ليس لديه صلاحية إرسال إشعارات WhatsApp' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // جلب معلومات الموظف
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_page_name, social_media')
      .eq('user_id', order.created_by)
      .single();

    // إنشاء رسالة WhatsApp
    const trackingUrl = `${Deno.env.get('SITE_URL') || 'https://pos.ryusbrand.com'}/track/${order.tracking_number}`;
    const message = `
مرحباً ${order.customer_name} 👋

تم تجهيز طلبك بنجاح! 📦
رقم الطلب: #${order.tracking_number}
من: ${profile?.business_page_name || 'متجرنا'}

🔗 تتبع طلبك: ${trackingUrl}

شكراً لثقتك! ✨
    `.trim();

    // إرسال عبر WhatsApp Business API
    const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!whatsappToken || !phoneNumberId) {
      console.log('WhatsApp API credentials not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'WhatsApp API غير مُعد بشكل صحيح' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whatsappResponse = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: order.customer_phone,
        type: 'text',
        text: { body: message }
      })
    });

    const result = await whatsappResponse.json();

    // تسجيل الإرسال
    await supabase
      .from('customer_notifications_sent')
      .insert({
        customer_id: null,
        notification_type: 'order_shipped',
        message: message,
        sent_via: 'whatsapp',
        success: whatsappResponse.ok,
        error_message: whatsappResponse.ok ? null : JSON.stringify(result)
      });

    return new Response(
      JSON.stringify({ success: whatsappResponse.ok, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('خطأ في إرسال الإشعار:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
