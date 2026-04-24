// Hook للإشعارات الفورية المحسّنة
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import devLog from '@/lib/devLogger';

export const useInstantNotifications = (userId, userRole) => {
  const channelsRef = useRef(new Set());
  const isAdmin = userRole?.includes('super_admin');

  useEffect(() => {
    if (!userId || !supabase) {
      devLog.log('❌ useInstantNotifications: Missing requirements');
      return;
    }

    devLog.log('🚀 Setting up instant notifications for user:', userId);

    // إعداد قناة الطلبات الذكية - بدون إشعار متصفح هنا
    // (الإشعار الموثوق يُرسَل من Edge Function ai-order-notifications
    //  ويعتمد على source الفعلي للطلب، فلا نريد إنشاء إشعار "تليغرام" خاطئ)
    const aiOrdersChannel = supabase
      .channel(`instant-ai-orders-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ai_orders'
        },
        (payload) => {
          devLog.log('⚡ Instant AI order event (UI only):', payload.new?.id);
          // فقط بث حدث للواجهة لتحديث القوائم - لا إشعارات متصفح هنا
          window.dispatchEvent(new CustomEvent('aiOrderCreated', { 
            detail: payload.new 
          }));
        }
      )
      .subscribe((status) => {
        devLog.log('📊 Instant AI orders subscription status:', status);
      });

    channelsRef.current.add(aiOrdersChannel);

    // إعداد قناة الطلبات العادية للإشعارات الفورية
    const ordersChannel = supabase
      .channel(`instant-orders-${userId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders'
        },
        (payload) => {
          const eventType = payload.eventType;
          devLog.log(`⚡ Instant order ${eventType}:`, payload.new || payload.old);
          
          // بث أحداث فورية بدون تأخير
          if (eventType === 'INSERT') {
            window.dispatchEvent(new CustomEvent('orderCreated', { 
              detail: payload.new 
            }));
          } else if (eventType === 'UPDATE') {
            window.dispatchEvent(new CustomEvent('orderUpdated', { 
              detail: payload.new 
            }));
          } else if (eventType === 'DELETE') {
            window.dispatchEvent(new CustomEvent('orderDeleted', { 
              detail: payload.old 
            }));
          }
        }
      )
      .subscribe();

    channelsRef.current.add(ordersChannel);

    // إعداد قناة إشعارات الفواتير الفورية
    const invoiceNotificationsChannel = supabase
      .channel(`instant-invoice-notifications-${userId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'invoice_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          devLog.log('⚡ Instant invoice notification:', payload.new);
          
          const notification = payload.new;
          
          // إشعار متصفح فوري
          notificationService.notify(
            notification.title,
            notification.message,
            notification.notification_type,
            notification.data
          ).catch(error => {
            devLog.log('⚠️ Browser notification not available:', error);
          });

          // بث حدث للواجهة
          window.dispatchEvent(new CustomEvent('invoiceNotification', { 
            detail: notification 
          }));
        }
      )
      .subscribe((status) => {
        devLog.log('📊 Invoice notifications subscription status:', status);
        if (status === 'SUBSCRIBED') {
          devLog.log('✅ Invoice notifications ready for user:', userId);
        }
      });

    channelsRef.current.add(invoiceNotificationsChannel);

    // تنظيف القنوات عند إلغاء التحميل
    return () => {
      devLog.log('🧹 Cleaning up instant notification channels');
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
    };
  }, [userId, isAdmin]);

  // دالة إضافية لإرسال إشعار فوري
  const sendInstantNotification = (title, message, type = 'default', data = {}) => {
    notificationService.notify(title, message, type, data).catch(error => {
      devLog.log('⚠️ Could not send browser notification:', error);
    });
  };

  return {
    sendInstantNotification
  };
};