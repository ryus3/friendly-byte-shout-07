import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import OrdersStats from './OrdersStats';

const PermissionBasedOrderStats = ({ orders, aiOrders, onAiOrdersClick, onStatCardClick }) => {
  const { user } = useAuth();
  const { canViewAllData, isSalesEmployee, isAdmin } = usePermissions();

  // فلترة البيانات حسب صلاحيات المستخدم
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (canViewAllData) return orders;
    return orders.filter(order => {
      const orderUserId = order.created_by;
      return orderUserId === user?.user_id || orderUserId === user?.id;
    });
  }, [orders, canViewAllData, user?.id, user?.user_id]);

  const filteredAiOrders = useMemo(() => {
    if (!aiOrders) return [];
    if (canViewAllData) return aiOrders;
    return aiOrders.filter(order => {
      const orderUserId = order.created_by;
      return orderUserId === user?.user_id || orderUserId === user?.id;
    });
  }, [aiOrders, canViewAllData, user?.id, user?.user_id]);

  // إخفاء أرباح النظام وإظهار أرباح الموظف فقط لموظفي المبيعات
  const filteredOrdersWithProfits = useMemo(() => {
    if (canViewAllData) return filteredOrders;
    
    // موظف المبيعات يرى طلباته بأرباحه الشخصية فقط وليس أرباح النظام
    return filteredOrders.map(order => ({
      ...order,
      // إخفاء الأرباح الإجمالية للنظام عن موظفي المبيعات
      total_profit: isSalesEmployee ? undefined : order.total_profit,
      system_profit: isSalesEmployee ? undefined : order.system_profit
    }));
  }, [filteredOrders, canViewAllData, isSalesEmployee]);

  return (
    <OrdersStats
      orders={filteredOrdersWithProfits}
      aiOrders={filteredAiOrders}
      onAiOrdersClick={onAiOrdersClick}
      onStatCardClick={onStatCardClick}
      showAllData={canViewAllData}
      userRole={isAdmin ? 'admin' : 'employee'}
    />
  );
};

export default PermissionBasedOrderStats;