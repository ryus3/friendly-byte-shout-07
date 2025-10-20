// Hook للإشعارات الفورية المحسّنة
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';

export const useInstantNotifications = (userId, userRole) => {
  const channelsRef = useRef(new Set());
  const isAdmin = userRole?.includes('super_admin');

  useEffect(() => {
    if (!userId || !supabase) {
      console.log('❌ useInstantNotifications: Missing requirements');
      return;
    }

    console.log('🚀 Setting up instant notifications for user:', userId);

    // 🔴 تم تعطيل قناة ai_orders مؤقتاً للاختبار - يوجد نظام موحد في useReliableAiOrderNotifications
    /*
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
          console.log('⚡ Instant AI order notification:', payload.new);
          
          // إشعار فوري بدون تأخير
          const orderData = {
            id: payload.new.id,
            source: payload.new.source || 'telegram',
            created_by: payload.new.created_by,
            timestamp: new Date().toISOString()
          };

          // إشعار متصفح فوري
          notificationService.notifyAiOrder(orderData).catch(error => {
            console.log('⚠️ Browser notification not available:', error);
          });

          // بث أحداث فورية للواجهة
          window.dispatchEvent(new CustomEvent('instantAiOrderNotification', { 
            detail: orderData 
          }));
          
          window.dispatchEvent(new CustomEvent('aiOrderCreated', { 
            detail: payload.new 
          }));
        }
      )
      .subscribe((status) => {
        console.log('📊 Instant AI orders subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Instant AI orders notifications ready');
        }
      });

    channelsRef.current.add(aiOrdersChannel);
    */

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
          console.log(`⚡ Instant order ${eventType}:`, payload.new || payload.old);
          
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

    // تنظيف القنوات عند إلغاء التحميل
    return () => {
      console.log('🧹 Cleaning up instant notification channels');
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
    };
  }, [userId, isAdmin]);

  // دالة إضافية لإرسال إشعار فوري
  const sendInstantNotification = (title, message, type = 'default', data = {}) => {
    notificationService.notify(title, message, type, data).catch(error => {
      console.log('⚠️ Could not send browser notification:', error);
    });
  };

  return {
    sendInstantNotification
  };
};