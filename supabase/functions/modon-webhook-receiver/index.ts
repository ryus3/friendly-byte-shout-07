import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, modon-auth-token',
};

// تعريف حالات MODON (مطابق لـ modon-statuses.js)
const MODON_STATUS_MAP: Record<string, { localStatus: string; receiptReceived: boolean; releasesStock: boolean }> = {
  '1': { localStatus: 'pending', receiptReceived: false, releasesStock: false },
  '2': { localStatus: 'shipped', receiptReceived: false, releasesStock: false },
  '3': { localStatus: 'delivery', receiptReceived: false, releasesStock: false },
  '4': { localStatus: 'delivered', receiptReceived: true, releasesStock: true },
  '5': { localStatus: 'returned', receiptReceived: false, releasesStock: false },
  '6': { localStatus: 'returned', receiptReceived: false, releasesStock: false },
  '7': { localStatus: 'returned_in_stock', receiptReceived: true, releasesStock: true },
  '8': { localStatus: 'delivery', receiptReceived: false, releasesStock: false },
  '9': { localStatus: 'delivery', receiptReceived: false, releasesStock: false },
  '10': { localStatus: 'delivery', receiptReceived: false, releasesStock: false },
  '11': { localStatus: 'returned', receiptReceived: false, releasesStock: false },
  '12': { localStatus: 'returned', receiptReceived: false, releasesStock: false },
  '13': { localStatus: 'delivery', receiptReceived: false, releasesStock: false },
  '14': { localStatus: 'delivery', receiptReceived: false, releasesStock: false },
  '15': { localStatus: 'delivery', receiptReceived: false, releasesStock: false },
};

function getModonStatusConfig(statusId: string) {
  return MODON_STATUS_MAP[statusId] || {
    localStatus: 'delivery',
    receiptReceived: false,
    releasesStock: false
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // التحقق من المصادقة (إذا كان مفعّل)
    const modonAuthToken = req.headers.get('modon-auth-token');
    const expectedToken = Deno.env.get('MODON_WEBHOOK_AUTH_TOKEN');
    
    if (expectedToken && modonAuthToken !== expectedToken) {
      console.log('❌ Unauthorized webhook attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // استقبال البيانات من MODON
    const orderUpdate = await req.json();
    console.log('📨 MODON Webhook received:', JSON.stringify(orderUpdate, null, 2));

    // التحقق من البيانات المطلوبة
    if (!orderUpdate.id) {
      console.log('⚠️ Missing order ID in webhook payload');
      return new Response(JSON.stringify({ error: 'Missing order ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // إنشاء Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // البحث عن الطلب بواسطة qr_id أو tracking_number أو delivery_partner_order_id
    const { data: orders, error: findError } = await supabase
      .from('orders')
      .select('*')
      .or(`qr_id.eq.${orderUpdate.id},tracking_number.eq.${orderUpdate.id},delivery_partner_order_id.eq.${orderUpdate.id}`)
      .limit(1);

    if (findError) {
      console.error('❌ Error finding order:', findError);
      return new Response(JSON.stringify({ error: 'Database error', details: findError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!orders || orders.length === 0) {
      console.log(`⚠️ Order not found: ${orderUpdate.id}`);
      return new Response(JSON.stringify({ success: false, error: 'Order not found', order_id: orderUpdate.id }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const order = orders[0];
    console.log(`✅ Found order: ${order.id} (${order.qr_id})`);

    // الحصول على تكوين الحالة من MODON
    const statusConfig = getModonStatusConfig(String(orderUpdate.status_id));
    
    // إعداد التحديثات
    const updates: any = {
      delivery_status: String(orderUpdate.status_id),
      status: statusConfig.localStatus,
      delivery_fee: parseFloat(orderUpdate.delivery_price) || order.delivery_fee || 0,
      receipt_received: statusConfig.receiptReceived,
      updated_at: new Date().toISOString()
    };

    // تحديث delivery_partner_order_id إذا لم يكن موجود
    if (!order.delivery_partner_order_id && orderUpdate.id) {
      updates.delivery_partner_order_id = String(orderUpdate.id);
    }

    console.log(`🔄 Updating order ${order.id} with status ${orderUpdate.status_id} (${statusConfig.localStatus})`);

    // تحديث الطلب في قاعدة البيانات
    const { error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', order.id);

    if (updateError) {
      console.error('❌ Error updating order:', updateError);
      return new Response(JSON.stringify({ error: 'Update failed', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Order ${orderUpdate.id} updated successfully`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: orderUpdate.id,
        internal_order_id: order.id,
        status: statusConfig.localStatus,
        delivery_status: String(orderUpdate.status_id)
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
