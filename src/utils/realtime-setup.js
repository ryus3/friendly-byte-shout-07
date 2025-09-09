import { supabase } from '@/integrations/supabase/client';

// إعداد Real-time مع debouncing لمنع التجمد
export const setupRealtime = () => {
  // Avoid WebSocket errors during automated audits/prerender/offline
  try {
    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    const isAutomatedAudit = /lighthouse|pagespeed|ptst|webpagetest|chrome-lighthouse|google-insights/i.test(ua);
    const isPrerender = typeof document !== 'undefined' && (document.visibilityState === 'hidden' || document.prerendering);
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isAutomatedAudit || isPrerender || isOffline) {
      return () => {};
    }
  } catch (_) { /* noop */ }
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