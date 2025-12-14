// نظام الإشعارات الموحد للطلبات الذكية - المصدر الوحيد للإشعارات
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { useNotifications } from '@/contexts/NotificationsContext';
import { devLog } from '@/lib/devLogger';

// متغير عالمي لتتبع الطلبات المعالجة
const processedOrders = new Set();

export const useReliableAiOrderNotifications = (user) => {
  const channelRef = useRef(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    // التأكد من وجود المستخدم
    if (!user?.id) {
      return;
    }

    // تنظيف القناة السابقة إن وجدت
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    devLog.log('🔄 AI Orders: Setting up notifications for user:', user.id);

    // إنشاء قناة للاستماع للطلبات الذكية الجديدة
    const channel = supabase
      .channel(`ai-orders-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ai_orders'
        },
        async (payload) => {
          const orderId = payload.new?.id;
          
          // تجاهل الطلبات المعالجة سابقاً
          if (!orderId || processedOrders.has(orderId)) {
            return;
          }
          
          // تسجيل الطلب كمعالج
          processedOrders.add(orderId);
          setTimeout(() => processedOrders.delete(orderId), 5 * 60 * 1000);

          devLog.log('⚡ AI Order received:', orderId);

          try {
            // جلب اسم منشئ الطلب
            let creatorName = 'موظف';
            if (payload.new?.created_by) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', payload.new.created_by)
                .single();
              
              if (profile?.full_name) {
                creatorName = profile.full_name;
              }
            }

            const isAdmin = user?.roles?.includes('super_admin');
            const isCreator = payload.new.created_by === user.id;
            const isManagerOrder = payload.new.created_by === '91484496-b887-44f7-9e5d-be9db5567604';

            // إشعار المنشئ
            if (isCreator) {
              await addNotification({
                type: 'new_ai_order',
                title: 'طلب ذكي جديد',
                message: `استلام طلب جديد من ${payload.new.source || 'التليغرام'} يحتاج للمراجعة`,
                icon: 'MessageSquare',
                color: 'green',
                data: { 
                  ai_order_id: orderId,
                  source: payload.new.source || 'telegram'
                },
                user_id: payload.new.created_by,
                is_read: false
              });
            }

            // إشعار المدير (ليس منشئ الطلب)
            if (isAdmin && !isManagerOrder && !isCreator) {
              await addNotification({
                type: 'new_ai_order',
                title: `طلب ذكي جديد من ${creatorName}`,
                message: `استلام طلب جديد من ${payload.new.source || 'التليغرام'} يحتاج للمراجعة`,
                icon: 'MessageSquare',
                color: 'amber',
                data: { 
                  ai_order_id: orderId,
                  employee_name: creatorName,
                  source: payload.new.source || 'telegram'
                },
                user_id: null,
                is_read: false
              });
            }

            // إشعار المتصفح
            if (isCreator || (isAdmin && !isManagerOrder)) {
              await notificationService.showNotification({
                title: isCreator ? 'طلب ذكي جديد' : `طلب ذكي جديد من ${creatorName}`,
                message: `استلام طلب جديد من ${payload.new.source || 'التليغرام'} يحتاج للمراجعة`,
                type: 'new_ai_order',
                id: orderId
              });
            }

            // إرسال أحداث UI
            window.dispatchEvent(new CustomEvent('aiOrderCreated', { 
              detail: { orderId, source: payload.new.source }
            }));
            window.dispatchEvent(new CustomEvent('newAiOrderNotification', { 
              detail: { orderId, creatorName, source: payload.new.source }
            }));

          } catch (error) {
            devLog.error('❌ AI Order notification error:', error);
          }
        }
      )
      .subscribe((status) => {
        devLog.log('📊 AI Orders subscription:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, user?.roles, addNotification]);

  return null;
};

export const getProcessedOrders = () => processedOrders;
