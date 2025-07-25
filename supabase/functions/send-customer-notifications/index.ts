import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  customer_id: string;
  notification_type: 'order_confirmed' | 'tier_upgrade' | 'discount_available';
  message: string;
  order_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { customer_id, notification_type, message, order_id }: NotificationRequest = await req.json();

    // البحث عن حساب التليغرام للعميل
    const { data: telegramAccount } = await supabase
      .from('customer_telegram_accounts')
      .select('telegram_chat_id, telegram_username')
      .eq('customer_id', customer_id)
      .eq('is_active', true)
      .single();

    if (!telegramAccount) {
      // إضافة إشعار نظام إذا لم يوجد حساب تليغرام
      await supabase
        .from('customer_notifications_sent')
        .insert({
          customer_id,
          notification_type,
          message,
          sent_via: 'system',
          success: true
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          method: 'system',
          message: 'تم إضافة الإشعار للنظام - العميل غير مربوط بالتليغرام' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // الحصول على رمز البوت من الإعدادات
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_token')
      .single();

    if (!settings?.value) {
      throw new Error('رمز بوت التليغرام غير مكون');
    }

    const botToken = settings.value;

    // إرسال الرسالة عبر التليغرام
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramAccount.telegram_chat_id,
        text: message,
        parse_mode: 'HTML'
      }),
    });

    const telegramResult = await telegramResponse.json();

    if (telegramResult.ok) {
      // تسجيل نجاح الإرسال
      await supabase
        .from('customer_notifications_sent')
        .insert({
          customer_id,
          notification_type,
          message,
          sent_via: 'telegram',
          telegram_message_id: telegramResult.result.message_id,
          success: true
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          method: 'telegram',
          message: 'تم إرسال الإشعار عبر التليغرام بنجاح',
          telegram_message_id: telegramResult.result.message_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // تسجيل فشل الإرسال
      await supabase
        .from('customer_notifications_sent')
        .insert({
          customer_id,
          notification_type,
          message,
          sent_via: 'telegram',
          success: false,
          error_message: telegramResult.description || 'خطأ غير معروف'
        });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'فشل إرسال الرسالة عبر التليغرام',
          telegram_error: telegramResult.description 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('خطأ في إرسال الإشعارات:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});