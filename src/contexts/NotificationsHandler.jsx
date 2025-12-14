import { useEffect } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { useUnreadNotificationsCheck } from '@/hooks/useUnreadNotificationsCheck';
import { useReliableAiOrderNotifications } from '@/hooks/useReliableAiOrderNotifications';
import { useAiOrderEventListener } from '@/hooks/useAiOrderEventListener';
import { useAiOrderFallbackChecker } from '@/hooks/useAiOrderFallbackChecker';

const NotificationsHandler = () => {
  const { user, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();
  
  // فحص الإشعارات غير المقروءة عند فتح الموقع
  useUnreadNotificationsCheck(user);
  
  // نظام إشعارات الطلبات الذكية الموثوق
  useReliableAiOrderNotifications(user);
  
  // مستمع أحداث الطلبات الذكية
  useAiOrderEventListener(user);
  
  // نظام احتياطي للتحقق من الطلبات الذكية الجديدة عند فتح الموقع
  useAiOrderFallbackChecker(user);

  useEffect(() => {
    // التحقق من الشروط الأساسية
    if (!supabase || !user || !addNotification) {
      console.log('❌ NotificationsHandler: Missing requirements', { 
        supabase: !!supabase, 
        user: !!user, 
        addNotification: !!addNotification 
      });
      return;
    }
    
    console.log('🔄 NotificationsHandler: Setting up notifications for user:', {
      userId: user.id,
      role: user.role,
      roles: user.roles,
      employeeCode: user.employee_code,
      isAdmin: user.roles?.includes('super_admin')
    });
    
    // فحص إذا كان المستخدم مدير - استخدام user.roles بدلاً من user.role
    const isAdmin = user.roles?.includes('super_admin');
    
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

    // إشعارات الطلبات الجديدة معطلة نهائياً لتجنب الإزعاج
    // const ordersChannel = supabase
    //   .channel('orders-notifications-handler-admin')
    //   .on(
    //     'postgres_changes',
    //     { event: 'INSERT', schema: 'public', table: 'orders' },
    //     (payload) => {
    //       // إشعارات new_order معطلة نهائياً بناءً على طلب المستخدم
    //       console.log('🔕 إشعار طلب جديد معطل:', payload.new.order_number);
    //     }
    //   )
    //   .subscribe();

    // ملاحظة: إشعارات ai_orders تتم من خلال useReliableAiOrderNotifications فقط لمنع التكرار

    // تنظيف القنوات
    return () => {
      supabase.removeChannel(profilesChannel);
    };
    
  }, [user, fetchAdminData, addNotification]);

  return null;
};

export default NotificationsHandler;