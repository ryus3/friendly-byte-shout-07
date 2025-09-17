import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * مكون لتنظيف الإشعارات المكررة والقديمة تلقائياً
 */
const NotificationCleanup = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !user.roles?.includes('super_admin')) {
      return; // فقط المديرون يقومون بالتنظيف
    }

    // تنظيف فوري عند تحميل المكون
    const cleanupNotifications = async () => {
      try {
        console.log('🧹 بدء تنظيف الإشعارات...');
        
        // استدعاء دالة التنظيف اليومية
        const { data, error } = await supabase.rpc('daily_notifications_cleanup');
        
        if (error) {
          console.error('❌ فشل تنظيف الإشعارات:', error);
        } else {
          console.log('✅ تم تنظيف الإشعارات بنجاح:', data);
        }
      } catch (err) {
        console.error('❌ خطأ في تنظيف الإشعارات:', err);
      }
    };

    // تنظيف فوري
    cleanupNotifications();

    // تنظيف دوري كل 30 دقيقة
    const cleanupInterval = setInterval(cleanupNotifications, 30 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [user]);

  return null; // مكون غير مرئي
};

export default NotificationCleanup;