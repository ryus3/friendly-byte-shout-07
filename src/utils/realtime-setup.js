import { supabase } from '@/lib/customSupabaseClient';

// إعداد Real-time للجداول المطلوبة بدون إعادة تحميل الصفحة
export const setupRealtime = () => {
  // تشغيل الإشعارات الفورية للطلبات العادية
  const ordersChannel = supabase
    .channel('orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders'
    }, (payload) => {
      // إرسال حدث مخصص فقط بدون إعادة تحميل
      if (payload.eventType === 'INSERT') {
        window.dispatchEvent(new CustomEvent('orderCreated', { detail: payload.new }));
      }
    })
    .subscribe();

  // تشغيل الإشعارات الفورية للطلبات الذكية
  const aiOrdersChannel = supabase
    .channel('ai-orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ai_orders'
    }, (payload) => {
      // إرسال حدث مخصص فقط بدون إعادة تحميل
      window.dispatchEvent(new CustomEvent('aiOrderCreated', { detail: payload.new }));
    })
    .subscribe();

  // تشغيل الإشعارات الفورية للإشعارات
  const notificationsChannel = supabase
    .channel('notifications-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      // إرسال حدث مخصص فقط بدون إعادة تحميل
      window.dispatchEvent(new CustomEvent('notificationCreated', { detail: payload.new }));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(aiOrdersChannel);
    supabase.removeChannel(notificationsChannel);
  };
};