import { supabase } from '@/integrations/supabase/client';

/**
 * إصلاح حالة الطلب من completed إلى delivered
 * للطلبات التي أصبحت completed بدون استلام فاتورة
 */
export async function fixOrderStatus(trackingNumber) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        updated_at: new Date().toISOString()
      })
      .eq('tracking_number', trackingNumber)
      .eq('status', 'completed')
      .eq('receipt_received', false)
      .select();

    if (error) {
      console.error('❌ خطأ في إصلاح حالة الطلب:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ تم إصلاح حالة الطلب:', data);
    return {
      success: true,
      message: `تم تحديث ${data?.length || 0} طلب من completed إلى delivered`,
      data
    };
  } catch (error) {
    console.error('❌ خطأ غير متوقع:', error);
    return { success: false, error: error.message };
  }
}

/**
 * إصلاح جميع الطلبات التي أصبحت completed بدون استلام فاتورة
 */
export async function fixAllCompletedOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'completed')
      .eq('receipt_received', false)
      .select();

    if (error) {
      console.error('❌ خطأ في إصلاح الطلبات:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ تم إصلاح جميع الطلبات:', data);
    return {
      success: true,
      message: `تم تحديث ${data?.length || 0} طلب من completed إلى delivered`,
      data
    };
  } catch (error) {
    console.error('❌ خطأ غير متوقع:', error);
    return { success: false, error: error.message };
  }
}

// تصدير الدوال للـ window لسهولة الوصول من console
if (typeof window !== 'undefined') {
  window.fixOrderStatus = fixOrderStatus;
  window.fixAllCompletedOrders = fixAllCompletedOrders;
}
