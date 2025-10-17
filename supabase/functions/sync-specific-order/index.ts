import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { tracking_number } = await req.json()

    console.log(`🔄 بدء مزامنة الطلب: ${tracking_number}`)

    // 1. جلب token الوسيط النشط
    const { data: tokenData, error: tokenError } = await supabase
      .from('delivery_partner_tokens')
      .select('token')
      .eq('partner_name', 'alwaseet')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (tokenError || !tokenData) {
      throw new Error('لم يتم العثور على token نشط للوسيط')
    }

    // 2. جلب الطلب من API الوسيط
    const waseetResponse = await supabase.functions.invoke('alwaseet-proxy', {
      body: {
        endpoint: 'get-order-by-id',
        method: 'get',
        token: tokenData.token,
        queryParams: { id: tracking_number }
      }
    })

    if (waseetResponse.error) {
      throw new Error(`فشل جلب الطلب من الوسيط: ${waseetResponse.error.message}`)
    }

    const waseetOrder = waseetResponse.data?.data

    if (!waseetOrder) {
      throw new Error('لم يتم العثور على الطلب في الوسيط')
    }

    console.log('✅ تم جلب الطلب من الوسيط:', waseetOrder)

    // 3. توحيد حالة التسليم
    const statusId = waseetOrder.status_id?.toString() || '1'
    const stateId = waseetOrder.state_id?.toString() || '1'
    const statusText = waseetOrder.status_text || 'فعال'

    let deliveryStatus = statusId
    if (stateId && stateId !== '1') {
      deliveryStatus = stateId
    }
    if (!deliveryStatus || deliveryStatus === '1') {
      deliveryStatus = statusText
    }

    // 4. تحديد الحالة المحلية
    const statusMapping: Record<string, string> = {
      '1': 'pending',
      '4': 'delivered',
      '17': 'returned_in_stock',
      '8': 'cancelled',
      '2': 'shipped',
      '3': 'delivery'
    }

    let localStatus = statusMapping[deliveryStatus] || 'pending'

    // 5. جلب الطلب المحلي
    const { data: localOrder, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('tracking_number', tracking_number)
      .single()

    if (orderError || !localOrder) {
      throw new Error(`لم يتم العثور على الطلب محلياً: ${tracking_number}`)
    }

    console.log('📦 الطلب المحلي الحالي:', {
      order_number: localOrder.order_number,
      status: localOrder.status,
      total_amount: localOrder.total_amount,
      final_amount: localOrder.final_amount,
      price_increase: localOrder.price_increase
    })

    // 6. حساب الأسعار من الوسيط
    const productsPriceFromWaseet = parseFloat(waseetOrder.total_price || '0')
    const deliveryFeeFromWaseet = parseFloat(waseetOrder.delivery_price || '0')

    // 7. الأسعار المحلية الحالية
    const currentProductsPrice = parseFloat(localOrder.total_amount || '0')
    const currentDeliveryFee = parseFloat(localOrder.delivery_fee || '0')
    const currentFinalAmount = parseFloat(localOrder.final_amount || '0')

    // 8. حساب الفرق في السعر
    const originalProductsPrice = currentFinalAmount - currentDeliveryFee
    const priceDiff = originalProductsPrice - productsPriceFromWaseet

    console.log('💰 تحليل الأسعار:', {
      productsPriceFromWaseet,
      currentProductsPrice,
      originalProductsPrice,
      priceDiff
    })

    // 9. تحديد التغييرات
    const updates: any = {
      status: localStatus,
      delivery_status: deliveryStatus,
      delivery_partner_order_id: waseetOrder.id?.toString() || tracking_number,
      updated_at: new Date().toISOString()
    }

    // 10. تحديث الأسعار إذا تغيرت
    if (productsPriceFromWaseet !== currentProductsPrice) {
      updates.total_amount = productsPriceFromWaseet
      updates.sales_amount = productsPriceFromWaseet
      
      if (priceDiff > 0) {
        updates.price_increase = priceDiff
        updates.price_change_type = 'increase'
        updates.discount = 0
      } else if (priceDiff < 0) {
        updates.discount = Math.abs(priceDiff)
        updates.price_increase = 0
        updates.price_change_type = 'discount'
      } else {
        updates.price_increase = 0
        updates.discount = 0
        updates.price_change_type = null
      }

      updates.final_amount = productsPriceFromWaseet + currentDeliveryFee
    }

    // 11. تحديث رسوم التوصيل إذا تغيرت
    if (deliveryFeeFromWaseet && deliveryFeeFromWaseet !== currentDeliveryFee) {
      updates.delivery_fee = deliveryFeeFromWaseet
      updates.final_amount = (updates.total_amount || currentProductsPrice) + deliveryFeeFromWaseet
    }

    // 12. تحديث حالة استلام الفاتورة
    if (waseetOrder.deliver_confirmed_fin === 1 || localStatus === 'delivered') {
      updates.receipt_received = true
    }

    console.log('🔄 التحديثات المطلوبة:', updates)

    // 13. تطبيق التحديثات
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('tracking_number', tracking_number)
      .select()
      .single()

    if (updateError) {
      throw new Error(`فشل تحديث الطلب: ${updateError.message}`)
    }

    console.log('✅ تم تحديث الطلب بنجاح')

    // 14. تحديث سجلات الأرباح إذا تغير السعر
    if (updates.total_amount) {
      const { error: profitError } = await supabase
        .from('profits')
        .update({
          total_revenue: updates.final_amount,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', localOrder.id)

      if (profitError) {
        console.warn('⚠️ فشل تحديث سجل الربح:', profitError.message)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `تم مزامنة الطلب ${tracking_number} بنجاح`,
        order: updatedOrder,
        updates,
        waseet_data: {
          status_id: statusId,
          state_id: stateId,
          status_text: statusText,
          products_price: productsPriceFromWaseet,
          delivery_fee: deliveryFeeFromWaseet
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ خطأ في المزامنة:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
