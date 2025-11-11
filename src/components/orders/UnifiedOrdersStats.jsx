import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useInventory } from '@/contexts/InventoryContext'; // النظام الموحد
import OrdersStats from './OrdersStats';

/**
 * مكون موحد لإحصائيات الطلبات - تم الإصلاح لاستخدام النظام الموحد
 */
const UnifiedOrdersStats = ({ onFilterChange, onCardClick, dateRange }) => {
  const { canViewAllOrders, filterDataByUser, user } = usePermissions();
  const { orders, loading } = useInventory(); // البيانات من النظام الموحد

  // تصفية الطلبات حسب صلاحيات المستخدم - البيانات مفلترة مسبقاً في SuperProvider
  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    
    // البيانات مفلترة تلقائياً من SuperProvider حسب المستخدم
    return orders;
  }, [orders]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <OrdersStats
      orders={filteredOrders}
      onFilterChange={onFilterChange}
      onCardClick={onCardClick}
      dateRange={dateRange}
    />
  );
};

export default UnifiedOrdersStats;