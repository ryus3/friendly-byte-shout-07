import { supabase } from '@/lib/customSupabaseClient';

// إعداد Real-time للجداول المطلوبة
export const setupRealtime = () => {
  // تشغيل الإشعارات الفورية للطلبات العادية
  const ordersChannel = supabase
    .channel('orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders'
    }, (payload) => {
      console.log('Order change detected:', payload);
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
      console.log('AI Order change detected:', payload);
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
      console.log('Notification change detected:', payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(aiOrdersChannel);
    supabase.removeChannel(notificationsChannel);
  };
};