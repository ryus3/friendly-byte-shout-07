import { supabase } from '@/integrations/supabase/client';

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
      // إرسال أحداث مخصصة مع debouncing لمنع التضارب
      const type = payload.eventType;
      
      // إضافة debouncing للأحداث لمنع التضارب
      const debounceEvent = (eventName, detail, delay = 100) => {
        const key = `${eventName}_${detail.id || detail.order_number || 'unknown'}`;
        clearTimeout(window.realtimeDebounceTimers?.[key]);
        window.realtimeDebounceTimers = window.realtimeDebounceTimers || {};
        
        window.realtimeDebounceTimers[key] = setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
          } catch (error) {
            console.warn('خطأ في حدث Real-time:', error);
          }
          delete window.realtimeDebounceTimers[key];
        }, delay);
      };
      
      if (type === 'INSERT') {
        debounceEvent('orderCreated', payload.new, 200);
      } else if (type === 'UPDATE') {
        debounceEvent('orderUpdated', payload.new, 150);
      } else if (type === 'DELETE') {
        debounceEvent('orderDeleted', payload.old, 100);
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
      // إرسال أحداث مخصصة مع debouncing لمنع التضارب
      const type = payload.eventType;
      
      // استخدام نفس نظام debouncing للطلبات الذكية
      const debounceAiEvent = (eventName, detail, delay = 100) => {
        const key = `${eventName}_${detail.id || 'unknown'}`;
        clearTimeout(window.realtimeDebounceTimers?.[key]);
        window.realtimeDebounceTimers = window.realtimeDebounceTimers || {};
        
        window.realtimeDebounceTimers[key] = setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
          } catch (error) {
            console.warn('خطأ في حدث AI Real-time:', error);
          }
          delete window.realtimeDebounceTimers[key];
        }, delay);
      };
      
      if (type === 'INSERT') {
        debounceAiEvent('aiOrderCreated', payload.new, 200);
      } else if (type === 'UPDATE') {
        debounceAiEvent('aiOrderUpdated', payload.new, 150);
      } else if (type === 'DELETE') {
        debounceAiEvent('aiOrderDeleted', payload.old, 100);
      }
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