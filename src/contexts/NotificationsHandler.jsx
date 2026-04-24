import { useEffect } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/integrations/supabase/client';
import { useUnreadNotificationsCheck } from '@/hooks/useUnreadNotificationsCheck';

const NotificationsHandler = () => {
  const { user, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();

  // فحص الإشعارات غير المقروءة عند فتح الموقع
  useUnreadNotificationsCheck(user);

  // ملاحظة: تم تعطيل المسارات القديمة التي كانت تنشئ إشعارات
  // "استلام طلب جديد من التليغرام يحتاج للمراجعة" حتى لو كان مصدر الطلب
  // هو المساعد الذكي. الإشعار الصحيح يأتي الآن من Edge Function
  // (ai-order-notifications) ويحترم حقل source الفعلي للطلب.
  // لذلك تم حذف:
  //   useReliableAiOrderNotifications, useAiOrderEventListener,
  //   useAiOrderFallbackChecker, و قناة ai_orders هنا.

  useEffect(() => {
    if (!supabase || !user || !addNotification) return;

    // إشعارات تسجيل المستخدمين الجدد فقط (للمدراء)
    const profilesChannel = supabase
      .channel('profiles-changes-notifications-handler-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.new.status === 'pending') {
            fetchAdminData?.();
            addNotification({
              type: 'new_registration',
              title: 'طلب تسجيل جديد',
              message: `الموظف ${payload.new.full_name || 'الجديد'} سجل في النظام.`,
              icon: 'UserPlus',
              color: 'purple',
              data: { id: payload.new.id },
              user_id: null,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, [user, fetchAdminData, addNotification]);

  return null;
};

export default NotificationsHandler;
