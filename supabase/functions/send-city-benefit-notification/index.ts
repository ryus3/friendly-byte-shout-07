import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderId, benefitType, benefitValue, cityName } = await req.json()

    console.log(`📢 إرسال إشعار مكافأة مدينة للطلب: ${orderId}`)

    // الحصول على بيانات الطلب والزبون
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, tracking_number, customer_name, customer_phone, created_by')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('❌ خطأ في جلب بيانات الطلب:', orderError)
      throw new Error('الطلب غير موجود')
    }

    // التحقق من صلاحية الموظف لإرسال واتساب
    const { data: permissions } = await supabaseClient
      .from('employee_notification_permissions')
      .select('can_send_whatsapp')
      .eq('user_id', order.created_by)
      .single()

    if (!permissions?.can_send_whatsapp) {
      console.log('⚠️ الموظف لا يملك صلاحية إرسال WhatsApp')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'الموظف لا يملك صلاحية إرسال إشعارات WhatsApp' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // الحصول على معلومات الصفحة التجارية للموظف
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('business_page_name')
      .eq('user_id', order.created_by)
      .single()

    const businessName = profile?.business_page_name || 'RYUS BRAND'

    // بناء رسالة WhatsApp
    const benefitText = benefitType === 'free_delivery' 
      ? 'توصيل مجاني 🚚' 
      : benefitType === 'discount_with_free_delivery'
      ? `خصم ${benefitValue}% + توصيل مجاني 🎁`
      : `خصم ${benefitValue}% 💰`

    const message = `🎉 *تهانينا ${order.customer_name}!*

حصلت على مكافأة خاصة من مدينة *${cityName}* الفائزة هذا الشهر! 🏆

✨ *المكافأة:* ${benefitText}
📦 *رقم الطلب:* ${order.tracking_number}

شكراً لثقتكم بـ *${businessName}*! 🌟

---
تتبع طلبك: https://pos.ryusbrand.com/track/${order.tracking_number}`

    // إرسال رسالة WhatsApp
    const whatsappPhoneId = Deno.env.get('WHATSAPP_BUSINESS_PHONE_ID')
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')

    if (!whatsappPhoneId || !whatsappToken) {
      throw new Error('WhatsApp API credentials not configured')
    }

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v17.0/${whatsappPhoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: order.customer_phone,
          type: 'text',
          text: { body: message }
        })
      }
    )

    const whatsappResult = await whatsappResponse.json()

    if (!whatsappResponse.ok) {
      console.error('❌ فشل إرسال WhatsApp:', whatsappResult)
      throw new Error('فشل إرسال رسالة WhatsApp')
    }

    console.log('✅ تم إرسال إشعار WhatsApp بنجاح:', whatsappResult)

    // تحديث حالة الإشعار في city_benefit_usage
    await supabaseClient
      .from('city_benefit_usage')
      .update({ notification_sent: true })
      .eq('order_id', orderId)

    // تسجيل الإشعار المُرسل
    await supabaseClient
      .from('customer_notifications_sent')
      .insert({
        customer_id: order.customer_name, // سنستخدم الاسم مؤقتاً
        notification_type: 'city_benefit',
        message: message,
        sent_via: 'whatsapp',
        success: true,
        sent_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'تم إرسال إشعار المكافأة بنجاح',
        whatsappMessageId: whatsappResult.messages?.[0]?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ خطأ في Edge Function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
