import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useInventory } from '@/contexts/InventoryContext'; // النظام الموحد
import CustomerStats from './CustomerStats';

/**
 * مكون موحد لإحصائيات العملاء - تم الإصلاح لاستخدام النظام الموحد
 */
const UnifiedCustomersStats = ({ onStatClick }) => {
  const { canViewAllCustomers, filterDataByUser, user } = usePermissions();
  const { customers, loading } = useInventory(); // البيانات من النظام الموحد

  // تصفية العملاء حسب صلاحيات المستخدم - البيانات مفلترة مسبقاً في SuperProvider
  const filteredCustomers = React.useMemo(() => {
    if (!customers) return [];
    return customers;
  }, [customers]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <CustomerStats
      customers={filteredCustomers}
      onStatClick={onStatClick}
    />
  );
};

export default UnifiedCustomersStats;