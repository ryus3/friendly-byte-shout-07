import { supabase } from '@/lib/customSupabaseClient';

// إعداد Real-time للجداول المطلوبة بدون إعادة تحميل الصفحة
export const setupRealtime = () => {
  console.log('🚀 تفعيل Real-time للنظام...');
  
  // تشغيل الإشعارات الفورية للطلبات العادية
  const ordersChannel = supabase
    .channel('orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders'
    }, (payload) => {
      console.log('📦 Order change detected:', payload);
      // إرسال حدث مخصص فقط بدون إعادة تحميل
      window.dispatchEvent(new CustomEvent('orderCreated', { detail: payload.new }));
    })
    .subscribe((status) => {
      console.log('Orders channel status:', status);
    });

  // تشغيل الإشعارات الفورية للطلبات الذكية
  const aiOrdersChannel = supabase
    .channel('ai-orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ai_orders'
    }, (payload) => {
      console.log('🤖 AI Order change detected:', payload);
      // إرسال حدث مخصص فقط بدون إعادة تحميل
      window.dispatchEvent(new CustomEvent('aiOrderCreated', { detail: payload.new }));
    })
    .subscribe((status) => {
      console.log('AI Orders channel status:', status);
    });

  // تشغيل الإشعارات الفورية للإشعارات
  const notificationsChannel = supabase
    .channel('notifications-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      console.log('🔔 Notification change detected:', payload);
      // إرسال حدث مخصص فقط بدون إعادة تحميل
      window.dispatchEvent(new CustomEvent('notificationCreated', { detail: payload.new }));
    })
    .subscribe((status) => {
      console.log('Notifications channel status:', status);
    });

  console.log('✅ Real-time مُفعل بنجاح');

  return () => {
    console.log('🔌 إيقاف Real-time connections');
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(aiOrdersChannel);
    supabase.removeChannel(notificationsChannel);
  };
};