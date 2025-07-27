import { useEffect } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';

const NotificationsHandler = () => {
  const { user, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();

  useEffect(() => {
    // التحقق من الشروط الأساسية
    if (!supabase || !user || !addNotification) {
      return;
    }
    
    // فحص إذا كان المستخدم مدير - تبسيط الفحص
    const isAdmin = user.role === 'admin';
    
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

    // New order notifications for admin
    const ordersChannel = supabase
      .channel('orders-notifications-handler-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          // جلب اسم المستخدم صاحب الطلب
          const getUserName = async () => {
            try {
              const { data: userData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', payload.new.created_by)
                .single();
              
              const userName = userData?.full_name || 'مستخدم غير معروف';
              
              addNotification({
                type: 'new_order',
                title: 'طلب جديد',
                message: `طلب رقم ${payload.new.order_number} من ${userName}`,
                icon: 'ShoppingCart',
                color: 'blue',
                data: { orderId: payload.new.id, orderNumber: payload.new.order_number },
                user_id: null, // Admin only
              });
            } catch (error) {
              console.error('Error fetching user name:', error);
              addNotification({
                type: 'new_order',
                title: 'طلب جديد',
                message: `طلب رقم ${payload.new.order_number}`,
                icon: 'ShoppingCart',
                color: 'blue',
                data: { orderId: payload.new.id, orderNumber: payload.new.order_number },
                user_id: null, // Admin only
              });
            }
          };
          
          getUserName();
        }
      )
      .subscribe();

    // إشعارات المخزون تتم الآن من خلال StockMonitoringSystem

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(ordersChannel);
    };
    
  }, [user, fetchAdminData, addNotification]);

  return null;
};

export default NotificationsHandler;