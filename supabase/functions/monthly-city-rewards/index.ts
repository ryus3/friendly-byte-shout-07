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

    // الحصول على الشهر والسنة الحاليين
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed

    console.log(`🎁 بدء إنشاء مكافآت شهرية: ${currentMonth}/${currentYear}`)

    // الخطوة 1: تحديث إحصائيات المدن للشهر الحالي
    const { error: statsError } = await supabaseClient.rpc('update_city_order_stats', {
      target_year: currentYear,
      target_month: currentMonth
    })

    if (statsError) {
      console.error('خطأ في تحديث إحصائيات المدن:', statsError)
      throw statsError
    }

    // الخطوة 2: الحصول على أفضل مدينة (الأكثر طلبات)
    const { data: topCity, error: topCityError } = await supabaseClient
      .from('city_order_stats')
      .select('city_name, total_orders, total_amount')
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .order('total_orders', { ascending: false })
      .limit(1)
      .single()

    if (topCityError || !topCity) {
      console.log('⚠️ لا توجد طلبات للشهر الحالي')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'لا توجد طلبات للشهر الحالي' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🏆 المدينة الفائزة: ${topCity.city_name} (${topCity.total_orders} طلب)`)

    // الخطوة 3: التحقق من عدم وجود مكافآت سابقة لهذا الشهر
    const { data: existingBenefits } = await supabaseClient
      .from('city_monthly_benefits')
      .select('id')
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .eq('city_name', topCity.city_name)

    if (existingBenefits && existingBenefits.length > 0) {
      console.log('✅ المكافآت موجودة بالفعل لهذا الشهر')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'المكافآت موجودة بالفعل',
          city: topCity.city_name
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // الخطوة 4: إنشاء مكافأة "توصيل مجاني"
    const { error: benefit1Error } = await supabaseClient
      .from('city_monthly_benefits')
      .insert({
        city_name: topCity.city_name,
        year: currentYear,
        month: currentMonth,
        benefit_type: 'free_delivery',
        benefit_value: 100, // 100% = مجاني
        max_usage: 1,
        current_usage: 0,
        is_active: true
      })

    if (benefit1Error) {
      console.error('خطأ في إنشاء مكافأة التوصيل المجاني:', benefit1Error)
      throw benefit1Error
    }

    // الخطوة 5: إنشاء مكافأة "خصم 5% + توصيل مجاني"
    const { error: benefit2Error } = await supabaseClient
      .from('city_monthly_benefits')
      .insert({
        city_name: topCity.city_name,
        year: currentYear,
        month: currentMonth,
        benefit_type: 'discount_with_free_delivery',
        benefit_value: 5, // خصم 5%
        max_usage: 1,
        current_usage: 0,
        is_active: true
      })

    if (benefit2Error) {
      console.error('خطأ في إنشاء مكافأة الخصم:', benefit2Error)
      throw benefit2Error
    }

    // الخطوة 6: إنشاء خصم عشوائي للمدينة
    const { error: discountError } = await supabaseClient
      .from('city_random_discounts')
      .insert({
        city_name: topCity.city_name,
        discount_year: currentYear,
        discount_month: currentMonth,
        discount_percentage: 5
      })

    if (discountError) {
      console.error('خطأ في إنشاء الخصم العشوائي:', discountError)
      throw discountError
    }

    console.log(`✅ تم إنشاء جميع المكافآت بنجاح للمدينة: ${topCity.city_name}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'تم إنشاء المكافآت الشهرية بنجاح',
        city: topCity.city_name,
        month: currentMonth,
        year: currentYear,
        totalOrders: topCity.total_orders,
        totalAmount: topCity.total_amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('خطأ في Edge Function:', error)
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