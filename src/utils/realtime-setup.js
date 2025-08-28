import { supabase } from '@/integrations/supabase/client';

// إعداد Real-time مع debouncing لمنع التجمد
export const setupRealtime = () => {
  let debounceTimers = new Map();
  
  const debouncedDispatch = (eventName, detail, delay = 200) => {
    const existingTimer = debounceTimers.get(eventName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const newTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
      debounceTimers.delete(eventName);
    }, delay);
    
    debounceTimers.set(eventName, newTimer);
  };

  // تشغيل الإشعارات الفورية للطلبات العادية مع debouncing
  const ordersChannel = supabase
    .channel('orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders'
    }, (payload) => {
      const type = payload.eventType;
      if (type === 'INSERT') {
        debouncedDispatch('orderCreated', payload.new, 150);
      } else if (type === 'UPDATE') {
        debouncedDispatch('orderUpdated', payload.new, 200);
      } else if (type === 'DELETE') {
        debouncedDispatch('orderDeleted', payload.old, 150);
      }
    })
    .subscribe();

  // تشغيل الإشعارات الفورية للطلبات الذكية مع debouncing
  const aiOrdersChannel = supabase
    .channel('ai-orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ai_orders'
    }, (payload) => {
      const type = payload.eventType;
      if (type === 'INSERT') {
        debouncedDispatch('aiOrderCreated', payload.new, 150);
      } else if (type === 'UPDATE') {
        debouncedDispatch('aiOrderUpdated', payload.new, 200);
      } else if (type === 'DELETE') {
        debouncedDispatch('aiOrderDeleted', payload.old, 150);
      }
    })
    .subscribe();

  // تشغيل الإشعارات الفورية للإشعارات مع debouncing
  const notificationsChannel = supabase
    .channel('notifications-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      debouncedDispatch('notificationCreated', payload.new, 100);
    })
    .subscribe();

  return () => {
    // تنظيف جميع الـ timers المعلقة
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
    
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(aiOrdersChannel);
    supabase.removeChannel(notificationsChannel);
  };
};