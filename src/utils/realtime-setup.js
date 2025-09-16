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

  // تشغيل الإشعارات الفورية للطلبات الذكية مع debouncing وتسجيل مفصل
  const aiOrdersChannel = supabase
    .channel('ai-orders-realtime-setup')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ai_orders'
    }, (payload) => {
      console.log('🔥 realtime-setup.js: AI Orders event received:', {
        eventType: payload.eventType,
        table: payload.table,
        schema: payload.schema,
        new: payload.new,
        old: payload.old
      });
      
      const type = payload.eventType;
      if (type === 'INSERT') {
        console.log('✅ realtime-setup.js: Dispatching aiOrderCreated event');
        debouncedDispatch('aiOrderCreated', payload.new, 150);
      } else if (type === 'UPDATE') {
        console.log('✅ realtime-setup.js: Dispatching aiOrderUpdated event');
        debouncedDispatch('aiOrderUpdated', payload.new, 200);
      } else if (type === 'DELETE') {
        console.log('✅ realtime-setup.js: Dispatching aiOrderDeleted event');
        debouncedDispatch('aiOrderDeleted', payload.old, 150);
      }
    })
    .subscribe((status) => {
      console.log('🔄 realtime-setup.js: AI Orders subscription status:', status);
    });

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

  // تشغيل الإشعارات الفورية للفواتير مع debouncing
  const invoicesChannel = supabase
    .channel('invoices-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'delivery_invoices'
    }, (payload) => {
      const type = payload.eventType;
      if (type === 'INSERT') {
        debouncedDispatch('invoiceCreated', payload.new, 150);
      } else if (type === 'UPDATE') {
        debouncedDispatch('invoiceUpdated', payload.new, 200);
        // تشغيل sync للفواتير المستلمة تلقائياً
        if (payload.new.received === true && payload.old?.received !== true) {
          debouncedDispatch('invoiceReceived', payload.new, 100);
        }
      }
    })
    .subscribe();

  return () => {
    // تنظيف جميع الـ timers المعلقة
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
    
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(aiOrdersChannel);
    supabase.removeChannel(notificationsChannel);
    supabase.removeChannel(invoicesChannel);
  };
};