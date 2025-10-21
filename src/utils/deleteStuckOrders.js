// سكريبت لحذف الطلبات العالقة في حلقة الحذف/الإعادة
import { supabase } from '@/integrations/supabase/client';

export async function deleteStuckOrders() {
  const stuckTrackingNumbers = [
    '108336162', '108335693', '108335671', '108335666', '108335664',
    '108335611', '108335568', '108335566', '108335565', '108335543',
    '108335499', '108335497', '108335449', '108335445', '108335443',
    '108335404'
  ];

  console.log(`🧹 بدء حذف ${stuckTrackingNumbers.length} طلب عالق...`);

  // 1. حذف order_items أولاً (foreign key constraint)
  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .in('order_id', 
      supabase
        .from('orders')
        .select('id')
        .in('tracking_number', stuckTrackingNumbers)
    );

  if (itemsError) {
    console.error('❌ خطأ في حذف order_items:', itemsError);
    return { success: false, error: itemsError };
  }

  // 2. حذف الطلبات
  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .in('tracking_number', stuckTrackingNumbers);

  if (ordersError) {
    console.error('❌ خطأ في حذف orders:', ordersError);
    return { success: false, error: ordersError };
  }

  // 3. إضافة للقائمة السوداء
  const blacklist = stuckTrackingNumbers.map(tn => ({
    tracking_number: tn,
    deleted_at: new Date().toISOString(),
    source: 'stuck_orders_cleanup'
  }));

  localStorage.setItem('permanentlyDeletedOrders', JSON.stringify(blacklist));

  console.log('✅ تم حذف الطلبات العالقة بنجاح');
  console.log('🔒 تم إضافة الطلبات للقائمة السوداء');
  
  return { success: true, deleted: stuckTrackingNumbers.length };
}
