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

    // 6. ✅ حساب الأسعار بالطريقة الصحيحة الموحدة
    const waseetTotalPrice = parseFloat(waseetOrder.total_price || waseetOrder.price || '0')
    const waseetDeliveryFee = parseFloat(waseetOrder.delivery_price || '0')
    
    // ✅ فصل سعر المنتجات: المنتجات = الشامل - التوصيل
    const productsPriceFromWaseet = waseetTotalPrice - waseetDeliveryFee

    // 7. الأسعار المحلية الحالية
    const currentProductsPrice = parseFloat(localOrder.total_amount || '0')
    const currentDeliveryFee = parseFloat(localOrder.delivery_fee || '0')
    const currentFinalAmount = parseFloat(localOrder.final_amount || '0')

    // 8. ✅ حساب السعر الأصلي للمنتجات (عند الإنشاء)
    const originalProductsPrice = currentFinalAmount - currentDeliveryFee
    
    // ✅ حساب الفرق بين السعر الأصلي والسعر الجديد
    const priceDiff = originalProductsPrice - productsPriceFromWaseet

    // 9. التحقق من صحة البيانات
    if (waseetTotalPrice > 0 && waseetTotalPrice < waseetDeliveryFee) {
      console.warn('⚠️ تحذير: السعر الشامل أقل من رسوم التوصيل!', {
        total: waseetTotalPrice,
        delivery: waseetDeliveryFee
      })
    }

    if (productsPriceFromWaseet < 0) {
      console.error('❌ خطأ: سعر المنتجات سالب!', {
        products: productsPriceFromWaseet,
        total: waseetTotalPrice,
        delivery: waseetDeliveryFee
      })
      throw new Error('سعر المنتجات سالب - تحقق من البيانات')
    }

    console.log('💰 تحليل الأسعار التفصيلي:', {
      waseet: {
        total_price: waseetTotalPrice,
        delivery_fee: waseetDeliveryFee,
        products_only: productsPriceFromWaseet
      },
      local: {
        total_amount: currentProductsPrice,
        delivery_fee: currentDeliveryFee,
        final_amount: currentFinalAmount,
        original_products: originalProductsPrice
      },
      comparison: {
        price_diff: priceDiff,
        needs_update: productsPriceFromWaseet !== currentProductsPrice
      }
    })

    // 9. تحديد التغييرات
    const updates: any = {
      status: localStatus,
      delivery_status: deliveryStatus,
      delivery_partner_order_id: waseetOrder.id?.toString() || tracking_number,
      updated_at: new Date().toISOString()
    }

    // 10. ✅ تحديث الأسعار إذا تغيرت (مع التحقق)
    if (productsPriceFromWaseet !== currentProductsPrice && waseetTotalPrice > 0) {
      updates.total_amount = productsPriceFromWaseet       // سعر المنتجات الجديد
      updates.sales_amount = productsPriceFromWaseet       // مماثل
      updates.delivery_fee = waseetDeliveryFee             // رسوم التوصيل
      updates.final_amount = productsPriceFromWaseet + waseetDeliveryFee  // الشامل
      
      // ✅ حساب الزيادة/الخصم بناءً على السعر الأصلي
      if (priceDiff > 0) {
        // الفرق إيجابي = خصم (السعر الجديد أقل)
        updates.discount = priceDiff
        updates.price_increase = 0
        updates.price_change_type = 'discount'
      } else if (priceDiff < 0) {
        // الفرق سالب = زيادة (السعر الجديد أعلى)
        updates.price_increase = Math.abs(priceDiff)
        updates.discount = 0
        updates.price_change_type = 'increase'
      } else {
        // لا تغيير
        updates.price_increase = 0
        updates.discount = 0
        updates.price_change_type = null
      }
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
