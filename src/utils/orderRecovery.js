// دالة استرداد الطلبات المحذوفة من شركة التوصيل
import { supabase } from '@/integrations/supabase/client';

export const recoverDeletedOrder = async (trackingNumber) => {
  try {
    console.log(`🔍 البحث عن الطلب المحذوف: ${trackingNumber}`);

    // البحث في شركة التوصيل
    const response = await fetch('/api/alwaseet/get-order-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber })
    });

    if (!response.ok) {
      throw new Error('فشل في الاتصال بشركة التوصيل');
    }

    const orderData = await response.json();
    
    if (!orderData || !orderData.exists) {
      throw new Error('الطلب غير موجود في شركة التوصيل');
    }

    // إعادة إنشاء الطلب في قاعدة البيانات
    const recoveredOrder = {
      tracking_number: trackingNumber,
      customer_name: orderData.customer_name || 'عميل مسترد',
      customer_phone: orderData.customer_phone || '',
      customer_city: orderData.customer_city || '',
      customer_province: orderData.customer_province || '',
      customer_address: `${orderData.customer_city} - ${orderData.customer_province}`,
      total_amount: orderData.total_amount || 0,
      delivery_fee: orderData.delivery_fee || 0,
      status: orderData.status || 'active',
      delivery_partner: 'alwaseet',
      created_by: null, // سيتم تحديدها لاحقاً
      order_items: orderData.items || [],
      notes: `طلب مسترد تلقائياً في ${new Date().toLocaleString('ar-EG')}`,
      receipt_received: false,
      is_recovered: true
    };

    // إدراج الطلب في قاعدة البيانات
    const { data: insertedOrder, error } = await supabase
      .from('orders')
      .insert([recoveredOrder])
      .select()
      .single();

    if (error) {
      throw new Error(`فشل في إدراج الطلب: ${error.message}`);
    }

    console.log(`✅ تم استرداد الطلب بنجاح: ${trackingNumber}`);
    return insertedOrder;

  } catch (error) {
    console.error(`❌ فشل في استرداد الطلب ${trackingNumber}:`, error);
    throw error;
  }
};

// دالة استرداد طلب محدد (99319996)
export const recoverSpecificOrder = async () => {
  try {
    const trackingNumber = '99319996';
    
    // التحقق من وجود الطلب أولاً
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('tracking_number', trackingNumber)
      .single();

    if (existingOrder) {
      console.log('⚠️ الطلب موجود بالفعل في قاعدة البيانات');
      return existingOrder;
    }

    // استرداد الطلب
    const recoveredOrder = await recoverDeletedOrder(trackingNumber);
    
    return {
      success: true,
      order: recoveredOrder,
      message: `تم استرداد الطلب ${trackingNumber} بنجاح`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `فشل في استرداد الطلب: ${error.message}`
    };
  }
};