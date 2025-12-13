// نظام الإشعارات المطور للطلبات الذكية - إصدار مبسط وموثوق
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { devLog } from '@/lib/devLogger';

export const useReliableAiOrderNotifications = (user) => {
  const channelRef = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    // التأكد من وجود المتطلبات الأساسية
    if (!user || !supabase || isInitialized.current) {
      return;
    }

    devLog.log('🔄 RELIABLE: Setting up AI orders notifications for user:', {
      userId: user.id,
      roles: user.roles,
      isAdmin: user?.roles?.includes('super_admin')
    });

    // إنشاء قناة مخصصة للطلبات الذكية فقط
    const aiOrderChannel = supabase
      .channel(`reliable-ai-orders-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ai_orders'
        },
        async (payload) => {
          devLog.log('⚡ RELIABLE: New AI order detected:', {
            orderId: payload.new?.id,
            source: payload.new?.source,
            createdBy: payload.new?.created_by,
            currentUser: user.id
          });

          try {
            // تحديد هوية منشئ الطلب
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

            // منطق الإشعارات المبسط
            const isAdmin = user?.roles?.includes('super_admin');
            const isCreator = payload.new.created_by === user.id;
            const isManagerOrder = payload.new.created_by === '91484496-b887-44f7-9e5d-be9db5567604';

            devLog.log('🔍 RELIABLE: Notification logic:', {
              isAdmin,
              isCreator,
              isManagerOrder,
              willNotify: isCreator || (isAdmin && !isManagerOrder)
            });

            // إشعارات فورية للواجهة (دائماً)
            const notificationData = {
              orderId: payload.new.id,
              creatorName,
              createdBy: payload.new.created_by,
              source: payload.new.source || 'telegram',
              timestamp: new Date().toISOString()
            };

            // إرسال إشعار للواجهة فوراً
            window.dispatchEvent(new CustomEvent('reliableAiOrderNotification', { 
              detail: notificationData
            }));

            // إشعار متصفح فوري
            const browserNotifTitle = isCreator 
              ? 'طلب ذكي جديد' 
              : `طلب ذكي جديد من ${creatorName}`;
            
            const browserNotifMessage = `استلام طلب جديد من ${payload.new.source || 'التليغرام'} يحتاج للمراجعة`;

            await notificationService.showNotification({
              title: browserNotifTitle,
              message: browserNotifMessage,
              type: 'new_ai_order',
              id: payload.new.id
            });

            devLog.log('✅ RELIABLE: Notifications sent successfully');

          } catch (error) {
            devLog.error('❌ RELIABLE: Error processing AI order notification:', error);
            
            // إشعار احتياطي بسيط
            window.dispatchEvent(new CustomEvent('reliableAiOrderNotification', { 
              detail: { 
                orderId: payload.new?.id || 'unknown',
                creatorName: 'موظف',
                fallback: true
              }
            }));
          }
        }
      )
      .subscribe((status) => {
        devLog.log('📊 RELIABLE: Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          devLog.log('✅ RELIABLE: AI orders notifications ready');
          isInitialized.current = true;
        }
      });

    channelRef.current = aiOrderChannel;

    // تنظيف عند إلغاء التحميل
    return () => {
      devLog.log('🧹 RELIABLE: Cleaning up');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isInitialized.current = false;
    };

  }, [user?.id, user?.roles]);

  return null;
};
