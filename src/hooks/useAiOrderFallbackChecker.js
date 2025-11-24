import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { useNotifications } from '@/contexts/NotificationsContext';

/**
 * نظام احتياطي للتحقق من الطلبات الذكية الجديدة عند فتح الموقع
 * يعمل كحل احتياطي في حالة فشل الإشعارات الفورية
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
        console.log('🔍 FALLBACK: Checking for new AI orders for user:', user.id);
        
        // جلب آخر طلب ذكي من قاعدة البيانات
        const { data: latestOrder, error } = await supabase
          .from('ai_orders')
          .select('id, created_at, customer_name, source, created_by')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 = No rows returned
          console.error('❌ FALLBACK: Error fetching latest AI order:', error);
          return;
        }

        if (!latestOrder) {
          console.log('✅ FALLBACK: No AI orders found');
          lastOrderIdRef.current = null;
          hasCheckedRef.current = true;
          return;
        }

        console.log('📦 FALLBACK: Latest AI order:', {
          id: latestOrder.id,
          createdAt: latestOrder.created_at,
          lastKnownOrderId: lastOrderIdRef.current
        });

        // التحقق من الـ localStorage للحصول على آخر طلب شاهده المستخدم
        const lastSeenOrderId = localStorage.getItem(`lastSeenAiOrder_${user.id}`);
        console.log('💾 FALLBACK: Last seen order ID from localStorage:', lastSeenOrderId);

        // إذا كان هناك طلب جديد لم يشاهده المستخدم
        if (latestOrder.id !== lastSeenOrderId) {
          console.log('🔥 FALLBACK: New AI order detected!', latestOrder.id);
          
          // التحقق من التوقيت - طلبات من آخر 10 دقائق فقط
          const orderTime = new Date(latestOrder.created_at);
          const tenMinutesAgo = new Date(Date.now() - (10 * 60 * 1000));
          
          if (orderTime > tenMinutesAgo) {
            console.log('⏰ FALLBACK: Order is recent, showing notification');
            
            // تحديد ما إذا كان المستخدم يجب أن يرى هذا الطلب
            const isAdmin = user?.roles?.includes('super_admin');
            const isCreator = latestOrder.created_by === user.id;
            const isManagerOrder = latestOrder.created_by === '91484496-b887-44f7-9e5d-be9db5567604';
            
            if (isCreator || (isAdmin && !isManagerOrder)) {
              console.log('✅ FALLBACK: User should see this order, creating notification');
              
              // جلب اسم المنشئ
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

              // إضافة إشعار للواجهة
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

              // إشعار متصفح
              await notificationService.showNotification({
                title: isCreator ? 'طلب ذكي جديد' : `طلب ذكي جديد من ${creatorName}`,
                message: `استلام طلب جديد من التليغرام يحتاج للمراجعة`,
                type: 'new_ai_order',
                id: latestOrder.id
              });

              console.log('✅ FALLBACK: Notification sent successfully');
            } else {
              console.log('ℹ️ FALLBACK: User should not see this order');
            }
          } else {
            console.log('⏰ FALLBACK: Order is too old, skipping notification');
          }

          // حفظ آخر طلب شاهده المستخدم
          localStorage.setItem(`lastSeenAiOrder_${user.id}`, latestOrder.id);
        } else {
          console.log('✅ FALLBACK: No new orders since last visit');
        }

        hasCheckedRef.current = true;
        
      } catch (error) {
        console.error('❌ FALLBACK: Error in AI order fallback check:', error);
      }
    };

    // تأخير قصير للسماح للنظام الأساسي بالعمل أولاً
    const timeoutId = setTimeout(checkForNewAiOrders, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, addNotification]);

  // دالة لتحديث آخر طلب شاهده المستخدم يدوياً
  const markAiOrderAsSeen = (orderId) => {
    if (user && orderId) {
      localStorage.setItem(`lastSeenAiOrder_${user.id}`, orderId);
      console.log('📝 FALLBACK: Marked AI order as seen:', orderId);
    }
  };

  return { markAiOrderAsSeen };
};