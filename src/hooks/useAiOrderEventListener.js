// مستمع أحداث الطلبات الذكية - يرسل أحداث UI فقط (الإشعارات من useReliableAiOrderNotifications)
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getProcessedOrders } from './useReliableAiOrderNotifications';

export const useAiOrderEventListener = (user) => {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!user || !supabase) {
      return;
    }

    // إنشاء قناة منفصلة لأحداث UI فقط
    const uiEventsChannel = supabase
      .channel(`ai-orders-ui-events-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ai_orders'
        },
        async (payload) => {
          const orderId = payload.new?.id;
          if (!orderId) return;
          
          // جلب اسم الموظف
          let employeeName = 'موظف';
          if (payload.new?.created_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', payload.new.created_by)
              .maybeSingle();
            
            if (profile?.full_name) {
              employeeName = profile.full_name;
            }
          }

          // إرسال أحداث UI لتحديث الواجهة
          window.dispatchEvent(new CustomEvent('newAiOrderNotification', { 
            detail: { 
              orderId,
              employeeName,
              createdBy: payload.new.created_by,
              timestamp: new Date().toISOString()
            } 
          }));

          window.dispatchEvent(new CustomEvent('aiOrderCreated', { 
            detail: { ...payload.new, employeeName } 
          }));

          // تحديث الإشعارات
          if (window.refreshNotifications) {
            window.refreshNotifications();
          }
        }
      )
      .subscribe();

    channelRef.current = uiEventsChannel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  return null;
};
