import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { useNotifications } from '@/contexts/NotificationsContext';
import devLog from '@/lib/devLogger';

/**
 * نظام احتياطي للتحقق من الطلبات الذكية الجديدة عند فتح الموقع
 */
export const useAiOrderFallbackChecker = (user) => {
  const { addNotification } = useNotifications();
  const hasCheckedRef = useRef(false);
  const lastOrderIdRef = useRef(null);

  useEffect(() => {
    if (!user || !supabase || hasCheckedRef.current) {
      return;
    }

    const checkForNewAiOrders = async () => {
      try {
        devLog.log('🔍 FALLBACK: Checking for new AI orders for user:', user.id);
        
        const { data: latestOrder, error } = await supabase
          .from('ai_orders')
          .select('id, created_at, customer_name, source, created_by')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          devLog.error('❌ FALLBACK: Error fetching latest AI order:', error);
          return;
        }

        if (!latestOrder) {
          devLog.log('✅ FALLBACK: No AI orders found');
          lastOrderIdRef.current = null;
          hasCheckedRef.current = true;
          return;
        }

        devLog.log('📦 FALLBACK: Latest AI order:', {
          id: latestOrder.id,
          createdAt: latestOrder.created_at,
          lastKnownOrderId: lastOrderIdRef.current
        });

        const lastSeenOrderId = localStorage.getItem(`lastSeenAiOrder_${user.id}`);
        devLog.log('💾 FALLBACK: Last seen order ID:', lastSeenOrderId);

        if (latestOrder.id !== lastSeenOrderId) {
          devLog.log('🔥 FALLBACK: New AI order detected!', latestOrder.id);
          
          const orderTime = new Date(latestOrder.created_at);
          const tenMinutesAgo = new Date(Date.now() - (10 * 60 * 1000));
          
          if (orderTime > tenMinutesAgo) {
            devLog.log('⏰ FALLBACK: Order is recent, showing notification');
            
            const isAdmin = user?.roles?.includes('super_admin');
            const isCreator = latestOrder.created_by === user.id;
            const isManagerOrder = latestOrder.created_by === '91484496-b887-44f7-9e5d-be9db5567604';
            
            if (isCreator || (isAdmin && !isManagerOrder)) {
              devLog.log('✅ FALLBACK: User should see this order');
              
              let creatorName = 'موظف';
              if (latestOrder.created_by) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('user_id', latestOrder.created_by)
                  .single();
                
                if (profile?.full_name) {
                  creatorName = profile.full_name;
                }
              }

              addNotification({
                type: 'new_ai_order',
                title: isCreator ? 'طلب ذكي جديد' : `طلب ذكي جديد من ${creatorName}`,
                message: `استلام طلب جديد من التليغرام يحتاج للمراجعة`,
                icon: 'MessageSquare',
                color: isCreator ? 'green' : 'amber',
                data: { 
                  ai_order_id: latestOrder.id,
                  created_by: latestOrder.created_by,
                  source: latestOrder.source || 'telegram'
                },
                user_id: isCreator ? user.id : null,
                is_read: false
              });

              await notificationService.showNotification({
                title: isCreator ? 'طلب ذكي جديد' : `طلب ذكي جديد من ${creatorName}`,
                message: `استلام طلب جديد من التليغرام يحتاج للمراجعة`,
                type: 'new_ai_order',
                id: latestOrder.id
              });

              devLog.log('✅ FALLBACK: Notification sent');
            } else {
              devLog.log('ℹ️ FALLBACK: User should not see this order');
            }
          } else {
            devLog.log('⏰ FALLBACK: Order is too old, skipping');
          }

          localStorage.setItem(`lastSeenAiOrder_${user.id}`, latestOrder.id);
        } else {
          devLog.log('✅ FALLBACK: No new orders since last visit');
        }

        hasCheckedRef.current = true;
        
      } catch (error) {
        devLog.error('❌ FALLBACK: Error in AI order fallback check:', error);
      }
    };

    const timeoutId = setTimeout(checkForNewAiOrders, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, addNotification]);

  const markAiOrderAsSeen = (orderId) => {
    if (user && orderId) {
      localStorage.setItem(`lastSeenAiOrder_${user.id}`, orderId);
      devLog.log('📝 FALLBACK: Marked AI order as seen:', orderId);
    }
  };

  return { markAiOrderAsSeen };
};
