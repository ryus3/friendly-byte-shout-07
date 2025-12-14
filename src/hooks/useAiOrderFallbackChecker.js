import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/devLogger';
import { getProcessedOrders } from './useReliableAiOrderNotifications';

/**
 * نظام احتياطي للتحقق من الطلبات الذكية - مُعدّل لمنع التكرار
 * يعمل فقط عند فتح الموقع لأول مرة ويتجنب الطلبات المعالجة سابقاً
 */
export const useAiOrderFallbackChecker = (user) => {
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!user || !supabase || hasCheckedRef.current) {
      return;
    }

    const checkForNewAiOrders = async () => {
      try {
        devLog.log('🔍 FALLBACK: Checking for missed AI orders');
        
        const { data: latestOrder, error } = await supabase
          .from('ai_orders')
          .select('id, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          devLog.error('❌ FALLBACK: Error fetching:', error);
          return;
        }

        if (!latestOrder) {
          hasCheckedRef.current = true;
          return;
        }

        const lastSeenOrderId = localStorage.getItem(`lastSeenAiOrder_${user.id}`);
        
        // تحديث localStorage فقط بدون إشعار (الإشعار يأتي من النظام الموحد)
        if (latestOrder.id !== lastSeenOrderId) {
          localStorage.setItem(`lastSeenAiOrder_${user.id}`, latestOrder.id);
          devLog.log('📝 FALLBACK: Updated last seen order');
        }

        hasCheckedRef.current = true;
        
      } catch (error) {
        devLog.error('❌ FALLBACK: Error:', error);
      }
    };

    const timeoutId = setTimeout(checkForNewAiOrders, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user]);

  const markAiOrderAsSeen = (orderId) => {
    if (user && orderId) {
      localStorage.setItem(`lastSeenAiOrder_${user.id}`, orderId);
      // إضافة للـ Set لمنع التكرار
      getProcessedOrders().add(orderId);
    }
  };

  return { markAiOrderAsSeen };
};
