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

  return (
    <OrdersStats
      orders={filteredOrders}
      aiOrders={filteredAiOrders}
      onAiOrdersClick={onAiOrdersClick}
      onStatCardClick={onStatCardClick}
      showAllData={canViewAllData}
      userRole={isAdmin ? 'admin' : 'employee'}
    />
  );
};

export default PermissionBasedOrderStats;