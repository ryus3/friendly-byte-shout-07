import { supabase } from '@/integrations/supabase/client';

// إعداد Real-time مع debouncing لمنع التجمد
export const setupRealtime = () => {
  let debounceTimers = new Map();
  
  const debouncedDispatch = (eventName, detail, delay = 25) => {
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
        debouncedDispatch('orderCreated', payload.new, 25);
      } else if (type === 'UPDATE') {
        debouncedDispatch('orderUpdated', payload.new, 25);
      } else if (type === 'DELETE') {
        debouncedDispatch('orderDeleted', payload.old, 25);
      }
    })
    .subscribe();

  // ملاحظة: تم إزالة ai_orders subscription من هنا لتجنب التعارض مع NotificationsHandler.jsx
  // جميع إشعارات ai_orders يتم التعامل معها في NotificationsHandler.jsx فقط

  // ✅ تخفيف: نكتفي بـ INSERT فقط على إشعارات جديدة، ولا نطلق dispatch لكل تغيير
  // (NotificationsContext يستمع مباشرةً لقناته الخاصة، لا داعي لقناة موازية تطلق events للجميع)
  const notificationsChannel = supabase
    .channel('notifications-realtime-light')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      // dispatch خفيف فقط لأنواع تحتاج تحديث counters فوراً
      const t = payload?.new?.type;
      if (t === 'new_ai_order' || t === 'ai_order' || t === 'new_registration') {
        debouncedDispatch('notificationCreated', payload.new, 60);
      }
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
        debouncedDispatch('invoiceCreated', payload.new, 25);
      } else if (type === 'UPDATE') {
        debouncedDispatch('invoiceUpdated', payload.new, 25);
        // تشغيل sync للفواتير المستلمة تلقائياً
        if (payload.new.received === true && payload.old?.received !== true) {
          debouncedDispatch('invoiceReceived', payload.new, 25);
        }
      }
    })
    .subscribe();

  return () => {
    // تنظيف جميع الـ timers المعلقة
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
    
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(notificationsChannel);
    supabase.removeChannel(invoicesChannel);
  };
};