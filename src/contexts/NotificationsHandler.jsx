import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';

const NotificationsHandler = () => {
  const { user, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();
  const { isAdmin } = usePermissionBasedData();

  useEffect(() => {
    // التحقق من الشروط الأساسية
    if (!supabase || !user || !addNotification) {
      return;
    }
    
    if (!isAdmin) {
      return; // إشعارات المدير فقط
    }
    
    // ADMIN ONLY NOTIFICATIONS - These create notifications directly
    
    // New user registration
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
              user_id: null, // Admin only
            });
          }
        }
      )
      .subscribe();

    // إشعارات المخزون تتم الآن من خلال StockMonitoringSystem

    return () => {
      supabase.removeChannel(profilesChannel);
    };
    
  }, [user, fetchAdminData, addNotification, isAdmin]);

  return null;
};

export default NotificationsHandler;