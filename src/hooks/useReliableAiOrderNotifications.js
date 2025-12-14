// نظام الإشعارات المطور للطلبات الذكية - إصدار موحد (المصدر الوحيد للإشعارات)
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { useNotifications } from '@/contexts/NotificationsContext';
import { devLog } from '@/lib/devLogger';

// متغير عالمي لتتبع آخر طلب تم معالجته (مشترك بين جميع المستمعات)
const processedOrders = new Set();

export const useReliableAiOrderNotifications = (user) => {
  const channelRef = useRef(null);
  const isInitialized = useRef(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    // التأكد من وجود المتطلبات الأساسية
    if (!user || !supabase || isInitialized.current) {
      return;
    }

    devLog.log('🔄 UNIFIED: Setting up AI orders notifications for user:', {
      userId: user.id,
      roles: user.roles
    });

    // إنشاء قناة مخصصة للطلبات الذكية فقط
    const aiOrderChannel = supabase
      .channel(`unified-ai-orders-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ai_orders'
        },
        async (payload) => {
          const orderId = payload.new?.id;
          
          // منع التكرار - تجاهل الطلبات المعالجة سابقاً
          if (!orderId || processedOrders.has(orderId)) {
            devLog.log('⏭️ UNIFIED: Skipping duplicate order:', orderId);
            return;
          }
          
          // تسجيل الطلب كمعالج فوراً
          processedOrders.add(orderId);
          
          // تنظيف Set بعد 5 دقائق لتجنب تراكم الذاكرة
          setTimeout(() => processedOrders.delete(orderId), 5 * 60 * 1000);

          devLog.log('⚡ UNIFIED: New AI order detected:', {
            orderId,
            source: payload.new?.source,
            createdBy: payload.new?.created_by
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

            // ترجمة المصدر للعربية
            const getSourceArabic = (source) => {
              const sources = {
                'telegram': 'التليغرام',
                'whatsapp': 'واتساب',
                'web': 'الموقع',
                'manual': 'يدوي'
              };
              return sources[source?.toLowerCase()] || 'التليغرام';
            };
            
            const sourceArabic = getSourceArabic(payload.new.source);

            // منطق الإشعارات
            const isAdmin = user?.roles?.includes('super_admin');
            const isCreator = payload.new.created_by === user.id;
            const isManagerOrder = payload.new.created_by === '91484496-b887-44f7-9e5d-be9db5567604';

            // إشعار المنشئ
            if (isCreator) {
              await addNotification({
                type: 'new_ai_order',
                title: 'طلب ذكي جديد',
                message: `استلام طلب جديد من ${sourceArabic} يحتاج للمراجعة`,
                icon: 'MessageSquare',
                color: 'green',
                data: { 
                  ai_order_id: orderId,
                  created_by: payload.new.created_by,
                  source: sourceArabic
                },
                user_id: payload.new.created_by,
                is_read: false
              });
            }

            // إشعار المدير (ليس منشئ الطلب) - يستلم إشعار عندما يكتب موظف طلب
            if (isAdmin && !isManagerOrder && !isCreator) {
              await addNotification({
                type: 'new_ai_order',
                title: `طلب ذكي جديد من ${creatorName}`,
                message: `استلام طلب جديد من ${sourceArabic} يحتاج للمراجعة`,
                icon: 'MessageSquare',
                color: 'amber',
                data: { 
                  ai_order_id: orderId,
                  created_by: payload.new.created_by,
                  employee_name: creatorName,
                  source: sourceArabic
                },
                user_id: null,
                is_read: false
              });
            }

            // إشعار المتصفح (مرة واحدة فقط)
            if (isCreator || (isAdmin && !isManagerOrder)) {
              await notificationService.showNotification({
                title: isCreator ? 'طلب ذكي جديد' : `طلب ذكي جديد من ${creatorName}`,
                message: `استلام طلب جديد من ${sourceArabic} يحتاج للمراجعة`,
                type: 'new_ai_order',
                id: orderId
              });
            }

            devLog.log('✅ UNIFIED: Notification sent successfully');

          } catch (error) {
            devLog.error('❌ UNIFIED: Error processing notification:', error);
          }
        }
      )
      .subscribe((status) => {
        devLog.log('📊 UNIFIED: Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          isInitialized.current = true;
        }
      });

    channelRef.current = aiOrderChannel;

    // تنظيف عند إلغاء التحميل
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isInitialized.current = false;
    };

  }, [user?.id, user?.roles, addNotification]);

  return null;
};

// تصدير Set للاستخدام في الأنظمة الأخرى
export const getProcessedOrders = () => processedOrders;
