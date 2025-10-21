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

  // 🛡️ فحص القائمة السوداء للطلبات المحذوفة
  const isOrderPermanentlyDeleted = (trackingNumber) => {
    if (!trackingNumber) return false;
    const permanentlyDeleted = JSON.parse(localStorage.getItem('permanentlyDeletedOrders') || '[]');
    return permanentlyDeleted.some(d => d.tracking_number === trackingNumber);
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
        // 🚫 منع إعادة إنشاء الطلبات المحذوفة
        const trackingNumber = payload.new?.delivery_partner_order_id || 
                              payload.new?.tracking_number || 
                              payload.new?.qr_id;
        if (isOrderPermanentlyDeleted(trackingNumber)) {
          console.log('🚫 منع إعادة إنشاء طلب محذوف:', trackingNumber);
          return;
        }
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

  // تشغيل الإشعارات الفورية للإشعارات مع debouncing
  const notificationsChannel = supabase
    .channel('notifications-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      debouncedDispatch('notificationCreated', payload.new, 25);
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