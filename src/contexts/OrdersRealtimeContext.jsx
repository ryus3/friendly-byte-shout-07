import React, { useEffect, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { getUserUUID } from '@/utils/userIdUtils';

/**
 * Context للطلبات في الوقت الفعلي
 * إصلاح جذري: يستخدم البيانات الموحدة من useInventory بدلاً من الطلبات المنفصلة
 */
const OrdersRealtimeContext = React.createContext();

export const useOrdersRealtime = () => {
  const context = React.useContext(OrdersRealtimeContext);
  if (!context) {
    throw new Error('useOrdersRealtime must be used within OrdersRealtimeProvider');
  }
  return context;
};

export const OrdersRealtimeProvider = ({ children }) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { orders, refreshOrders } = useInventory(); // استخدام البيانات الموحدة فقط!

  // تحديث الطلبات من النظام الموحد - لا مزيد من الطلبات المنفصلة!
  const refreshOrdersFromUnifiedSystem = useCallback(async () => {
    console.log('🔄 تحديث الطلبات من النظام الموحد - بدون طلبات منفصلة');
    
    // استخدام refresh من النظام الموحد بدلاً من طلبات منفصلة
    if (refreshOrders) {
      await refreshOrders();
    }
    
    console.log('✅ تم تحديث الطلبات من النظام الموحد');
  }, [refreshOrders]);

  // الاستماع للتحديثات في الوقت الفعلي
  useEffect(() => {
    if (!user) return;

    console.log('🔔 بدء الاستماع للطلبات في الوقت الفعلي للمستخدم:', getUserUUID(user));

    // إعداد الاستماع لتحديثات قاعدة البيانات
    const { supabase } = require('@/lib/customSupabaseClient');
    
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('📦 تحديث طلب في الوقت الفعلي:', payload);
          
          // تحديث من النظام الموحد بدلاً من معالجة التحديث محلياً
          // SuperProvider صار يحدث الحالة محلياً فوراً، لتجنب الوميض لا نعيد الجلب هنا
          
          // إضافة إشعار إذا كان الطلب للمستخدم الحالي
          const userUUID = getUserUUID(user);
          if (payload.new?.created_by === userUUID) {
            addNotification({
              title: 'تحديث طلب',
              message: `تم تحديث الطلب #${payload.new.order_number}`,
              type: 'order_update'
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 إيقاف الاستماع للطلبات في الوقت الفعلي');
      supabase.removeChannel(channel);
    };
  }, [user, refreshOrdersFromUnifiedSystem, addNotification]);

  // إحصائيات سريعة من البيانات الموحدة
  const orderStats = React.useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return {
        total: 0,
        pending: 0,
        completed: 0,
        delivered: 0
      };
    }

    const userUUID = getUserUUID(user);
    const userOrders = orders.filter(order => order.created_by === userUUID);

    return {
      total: userOrders.length,
      pending: userOrders.filter(o => o.status === 'pending').length,
      completed: userOrders.filter(o => o.status === 'completed').length,
      delivered: userOrders.filter(o => o.status === 'delivered').length
    };
  }, [orders, user]);

  const value = {
    orders, // البيانات من النظام الموحد
    orderStats,
    refreshOrders: refreshOrdersFromUnifiedSystem, // استخدام النظام الموحد
    loading: false // البيانات متوفرة فوراً من النظام الموحد
  };

  return (
    <OrdersRealtimeContext.Provider value={value}>
      {children}
    </OrdersRealtimeContext.Provider>
  );
};

export default OrdersRealtimeContext;