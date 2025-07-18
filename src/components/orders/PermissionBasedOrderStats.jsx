import React, { useMemo } from 'react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import OrdersStats from './OrdersStats';

const PermissionBasedOrderStats = ({ orders, aiOrders, onAiOrdersClick, onStatCardClick }) => {
  const { 
    filterDataByUser, 
    canViewAllData,
    isAdmin,
    isEmployee 
  } = usePermissionBasedData();

  // فلترة البيانات حسب صلاحيات المستخدم
  const filteredOrders = useMemo(() => {
    return filterDataByUser(orders, 'created_by');
  }, [orders, filterDataByUser]);

  const filteredAiOrders = useMemo(() => {
    return filterDataByUser(aiOrders, 'created_by');
  }, [aiOrders, filterDataByUser]);

  // إخفاء أرباح النظام وإظهار أرباح الموظف فقط لموظفي المبيعات
  const filteredOrdersWithProfits = useMemo(() => {
    if (canViewAllData) return filteredOrders;
    
    // موظف المبيعات يرى طلباته بأرباحه الشخصية فقط وليس أرباح النظام
    return filteredOrders.map(order => ({
      ...order,
      // إخفاء الأرباح الإجمالية للنظام عن موظفي المبيعات
      total_profit: isEmployee ? undefined : order.total_profit,
      system_profit: isEmployee ? undefined : order.system_profit
    }));
  }, [filteredOrders, canViewAllData, isEmployee]);

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