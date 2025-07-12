import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useInventory } from './InventoryContext';

const NotificationsHandler = () => {
  const { user, hasPermission, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();
  const { settings } = useInventory();

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

    // Low stock alerts
    const lowStockChannel = supabase
      .channel('low-stock-notifications-handler-admin')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'product_variants' },
        (payload) => {
            const oldQty = payload.old.quantity;
            const newQty = payload.new.quantity;
            const lowStockThreshold = settings?.lowStockThreshold || 5;
            
            if (oldQty > lowStockThreshold && newQty <= lowStockThreshold && newQty > 0) {
                 addNotification({
                    type: 'low_stock',
                    title: 'انخفاض المخزون',
                    message: `مخزون المنتج ${payload.new.sku} منخفض (${newQty}).`,
                    icon: 'AlertTriangle',
                    color: 'orange',
                    link: `/inventory?highlight=${payload.new.sku}`,
                    user_id: null, // Admin only
                });
            }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(lowStockChannel);
    };
    
  }, [supabase, user, hasPermission, fetchAdminData, addNotification, settings]);

  return null;
};

export default NotificationsHandler;