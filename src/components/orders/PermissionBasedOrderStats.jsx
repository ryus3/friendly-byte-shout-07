import React from 'react';
import OrdersStats from './OrdersStats';

/**
 * عنصر موحد لإحصائيات الطلبات - يعرض نفس المحتوى للجميع
 * مع اختلاف البيانات فقط حسب الصلاحيات (تتم الفلترة في OrdersPage)
 */
const PermissionBasedOrderStats = ({ orders, aiOrders, onAiOrdersClick, onStatCardClick, globalPeriod }) => {
  return (
    <OrdersStats
      orders={orders}
      aiOrders={aiOrders}
      onAiOrdersClick={onAiOrdersClick}
      onStatCardClick={onStatCardClick}
      globalPeriod={globalPeriod}
    />
  );
};

export default PermissionBasedOrderStats;