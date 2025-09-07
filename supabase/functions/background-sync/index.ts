import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncSettings {
  invoice_auto_sync: boolean;
  invoice_daily_sync: boolean;
  invoice_sync_time: string;
  orders_auto_sync: boolean;
  orders_twice_daily: boolean;
  orders_morning_time: string;
  orders_evening_time: string;
  orders_sync_enabled: boolean;
  orders_sync_every_hours: number;
  orders_visible_only: boolean;
  delivery_invoices_daily_sync: boolean;
  delivery_invoices_sync_time: string;
  sync_work_hours_only: boolean;
  work_start_hour: number;
  work_end_hour: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { sync_type = 'legacy' } = await req.json().catch(() => ({}));
    console.log(`🕒 بدء المزامنة التلقائية في الخلفية - نوع: ${sync_type}...`)

    // جلب إعدادات المزامنة
    const { data: syncSettings, error: settingsError } = await supabaseClient
      .from('invoice_sync_settings')
      .select('*')
      .maybeSingle()

    if (settingsError) {
      console.error('خطأ في جلب إعدادات المزامنة:', settingsError)
      throw settingsError
    }

    const settings: SyncSettings = syncSettings || {
      invoice_auto_sync: true,
      invoice_daily_sync: true,
      invoice_sync_time: '09:00:00',
      orders_auto_sync: true,
      orders_twice_daily: true,
      orders_morning_time: '09:00:00',
      orders_evening_time: '18:00:00',
      orders_sync_enabled: true,
      orders_sync_every_hours: 3,
      orders_visible_only: true,
      delivery_invoices_daily_sync: true,
      delivery_invoices_sync_time: '09:00:00',
      sync_work_hours_only: true,
      work_start_hour: 8,
      work_end_hour: 20
    }

    const now = new Date()
    const currentHour = now.getHours()
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 8)

    console.log(`⏰ الوقت الحالي: ${currentTime}, الساعة: ${currentHour}`)

    // التحقق من ساعات العمل
    if (settings.sync_work_hours_only) {
      if (currentHour < settings.work_start_hour || currentHour > settings.work_end_hour) {
        console.log(`⏸️ خارج ساعات العمل (${settings.work_start_hour}-${settings.work_end_hour})`)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'خارج ساعات العمل',
            skipped: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    let syncResults = {
      invoices_synced: 0,
      orders_updated: 0,
      sync_type: 'none'
    }

    // معالجة أنواع المزامنة المختلفة
    if (sync_type === 'orders_tracking') {
      // مزامنة طلبات صفحة متابعة الطلبات (كل 3 ساعات)
      if (settings.orders_sync_enabled) {
        console.log('📦 بدء مزامنة طلبات صفحة متابعة الطلبات...')
        
        const { data: ordersData, error: ordersError } = await supabaseClient.functions.invoke('smart-invoice-sync', {
          body: { 
            mode: 'smart',
            sync_invoices: false,
            sync_orders: true,
            orders_visible_only: settings.orders_visible_only,
            context: 'orders_tracking',
            force_refresh: false
          }
        })

        if (!ordersError && ordersData) {
          syncResults.orders_updated = ordersData.orders_updated || 0
          syncResults.sync_type = 'orders_tracking'
          console.log(`✅ مزامنة طلبات متابعة الطلبات: ${syncResults.orders_updated} طلب محدث`)
        }
      }
    } else if (sync_type === 'delivery_invoices') {
      // مزامنة فواتير التوصيل اليومية
      if (settings.delivery_invoices_daily_sync) {
        console.log('📄 بدء مزامنة فواتير التوصيل اليومية...')
        
        const { data: invoiceData, error: invoiceError } = await supabaseClient.functions.invoke('smart-invoice-sync', {
          body: { 
            mode: 'smart',
            sync_invoices: true,
            sync_orders: false,
            force_refresh: false
          }
        })

        if (!invoiceError && invoiceData) {
          syncResults.invoices_synced = invoiceData.invoices_synced || 0
          syncResults.sync_type = 'delivery_invoices'
          console.log(`✅ مزامنة فواتير التوصيل: ${syncResults.invoices_synced} فاتورة جديدة`)
        }
      }
    } else {
      // المزامنة القديمة للتوافق مع الإعدادات الموجودة
      
      // مزامنة الفواتير اليومية
      if (settings.invoice_auto_sync && settings.invoice_daily_sync) {
        const invoiceTime = settings.invoice_sync_time
        const [invoiceHour, invoiceMinute] = invoiceTime.split(':').map(Number)
        
        if (currentHour === invoiceHour && now.getMinutes() >= invoiceMinute && now.getMinutes() < invoiceMinute + 5) {
          console.log('📄 بدء مزامنة الفواتير اليومية...')
          
          const { data: invoiceData, error: invoiceError } = await supabaseClient.functions.invoke('smart-invoice-sync', {
            body: { 
              mode: 'smart',
              sync_invoices: true,
              sync_orders: false,
              force_refresh: false
            }
          })

          if (!invoiceError && invoiceData) {
            syncResults.invoices_synced = invoiceData.invoices_synced || 0
            syncResults.sync_type = 'invoices'
            console.log(`✅ مزامنة الفواتير: ${syncResults.invoices_synced} فاتورة جديدة`)
          }
        }
      }

      // مزامنة الطلبات (مرتين يومياً)
      if (settings.orders_auto_sync && settings.orders_twice_daily) {
        const morningTime = settings.orders_morning_time
        const eveningTime = settings.orders_evening_time
        const [morningHour, morningMinute] = morningTime.split(':').map(Number)
        const [eveningHour, eveningMinute] = eveningTime.split(':').map(Number)
        
        const isMorningSync = currentHour === morningHour && now.getMinutes() >= morningMinute && now.getMinutes() < morningMinute + 5
        const isEveningSync = currentHour === eveningHour && now.getMinutes() >= eveningMinute && now.getMinutes() < eveningMinute + 5
        
        if (isMorningSync || isEveningSync) {
          console.log(`📦 بدء مزامنة الطلبات ${isMorningSync ? 'الصباحية' : 'المسائية'}...`)
          
          const { data: ordersData, error: ordersError } = await supabaseClient.functions.invoke('smart-invoice-sync', {
            body: { 
              mode: 'smart',
              sync_invoices: false,
              sync_orders: true,
              force_refresh: false
            }
          })

          if (!ordersError && ordersData) {
            syncResults.orders_updated = ordersData.orders_updated || 0
            syncResults.sync_type = syncResults.sync_type === 'invoices' ? 'both' : 'orders'
            console.log(`✅ مزامنة الطلبات: ${syncResults.orders_updated} طلب محدث`)
          }
        }
      }
    }

    // تسجيل النتائج
    if (syncResults.sync_type !== 'none') {
      await supabaseClient
        .from('background_sync_logs')
        .insert({
          sync_type: syncResults.sync_type,
          invoices_synced: syncResults.invoices_synced,
          orders_updated: syncResults.orders_updated,
          sync_time: now.toISOString(),
          success: true
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...syncResults,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ خطأ في المزامنة التلقائية:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})