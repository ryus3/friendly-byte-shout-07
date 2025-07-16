import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';

const NotificationsHandler = () => {
  const { user, hasPermission, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!supabase || !user || !hasPermission('*')) {
      return;
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
            fetchAdminData();
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
    
  }, [supabase, user, hasPermission, fetchAdminData, addNotification]);

  return null;
};

export default NotificationsHandler;