import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import OrdersStats from './OrdersStats';

/**
 * مكون موحد لإحصائيات الطلبات
 * يستخدم النظام الموحد للصلاحيات وضمان عدم خلط طلبات المستخدمين
 */
const UnifiedOrdersStats = ({ onFilterChange, onCardClick, dateRange }) => {
  const { canViewAllOrders, filterDataByUser, user } = usePermissions();
  const { data: allOrders, loading } = useSupabaseData('orders');

  // تصفية الطلبات حسب صلاحيات المستخدم - كل مستخدم يرى طلباته فقط
  const filteredOrders = React.useMemo(() => {
    if (!allOrders) return [];
    
    // المديرون يرون جميع الطلبات إذا كان لديهم الصلاحية
    if (canViewAllOrders) {
      return allOrders;
    }
    
    // الموظفون يرون طلباتهم فقط (المنشؤة بواسطتهم)
    return allOrders.filter(order => order.created_by === user?.id);
  }, [allOrders, canViewAllOrders, user?.id]);

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