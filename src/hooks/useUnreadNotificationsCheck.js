import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import devLog from '@/lib/devLogger';

// Hook للتحقق من الإشعارات غير المقروءة عند فتح الموقع
export const useUnreadNotificationsCheck = (user) => {
  const hasCheckedRef = useRef(false);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (!user || !supabase || hasCheckedRef.current) {
      return;
    }

    const checkUnreadNotifications = async () => {
      try {
        devLog.log('🔍 Checking for unread notifications for user:', user.id);
        
        // جلب الإشعارات غير المقروءة منذ آخر 24 ساعة
        const now = Date.now();
        const twentyFourHoursAgo = new Date(now - (24 * 60 * 60 * 1000)).toISOString();
        
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('is_read', false)
          .gte('created_at', twentyFourHoursAgo)
          .order('created_at', { ascending: false })
          .limit(5); // آخر 5 إشعارات غير مقروءة

        // فلترة حسب المستخدم
        const isAdmin = user?.roles?.includes('super_admin') || user?.roles?.includes('admin');
        if (!isAdmin) {
          query = query.or(`user_id.eq.${user.id},and(user_id.is.null,type.not.in.(profit_settlement_request,settlement_request,profit_settlement_completed,new_registration,low_stock,order_status_update_admin,new_order,order_created,cash_correction,balance_correction,main_cash_correction))`);
        } else {
          query = query.or(`user_id.eq.${user.id},user_id.is.null`);
        }

        const { data: unreadNotifications, error } = await query;
        
        if (error) {
          console.error('❌ Error fetching unread notifications:', error);
          return;
        }

        devLog.log('📬 Found unread notifications:', unreadNotifications?.length || 0);

        if (unreadNotifications && unreadNotifications.length > 0) {
          // إظهار إشعارات المتصفح للإشعارات غير المقروءة
          for (const notification of unreadNotifications) {
            devLog.log('🔔 Showing browser notification for unread:', notification.title);
            
            // تأخير قصير بين الإشعارات لتجنب الإزعاج
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await notificationService.showNotification({
              title: `📬 ${notification.title}`,
              message: notification.message,
              type: notification.type,
              id: notification.data?.ai_order_id || notification.data?.order_id || notification.id
            });
          }

          // إظهار إشعار ملخص إذا كان هناك أكثر من إشعار واحد
          if (unreadNotifications.length > 1) {
            await notificationService.showNotification({
              title: '📬 إشعارات جديدة',
              message: `لديك ${unreadNotifications.length} إشعارات جديدة غير مقروءة`,
              type: 'summary',
              id: 'summary'
            });
          }
        } else {
          devLog.log('✅ No unread notifications found');
        }

        hasCheckedRef.current = true;
        lastCheckRef.current = now;
        
      } catch (error) {
        console.error('❌ Error in unread notifications check:', error);
      }
    };

    // تأخير قصير للسماح للتطبيق بالتحميل كاملاً
    const timeoutId = setTimeout(checkUnreadNotifications, 3000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user]);

  // دالة لإعادة فحص الإشعارات يدوياً
  const recheckNotifications = () => {
    hasCheckedRef.current = false;
    const event = new CustomEvent('recheck-unread-notifications');
    window.dispatchEvent(event);
  };

  return { recheckNotifications };
};