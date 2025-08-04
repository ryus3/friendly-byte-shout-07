import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import CustomerStats from './CustomerStats';

/**
 * مكون موحد لإحصائيات العملاء
 * يستخدم النظام الموحد للصلاحيات وضمان عدم خلط عملاء المستخدمين
 */
const UnifiedCustomersStats = ({ onStatClick }) => {
  const { canViewAllCustomers, filterDataByUser, user } = usePermissions();
  const { data: allCustomers, loading } = useSupabaseData('customers');

  // تصفية العملاء حسب صلاحيات المستخدم - كل مستخدم يرى عملاءه فقط
  const filteredCustomers = React.useMemo(() => {
    if (!allCustomers) return [];
    
    // المديرون يرون جميع العملاء إذا كان لديهم الصلاحية
    if (canViewAllCustomers) {
      return allCustomers;
    }
    
    // الموظفون يرون عملاءهم فقط (المنشؤون بواسطتهم)
    return allCustomers.filter(customer => customer.created_by === user?.id);
  }, [allCustomers, canViewAllCustomers, user?.id]);

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