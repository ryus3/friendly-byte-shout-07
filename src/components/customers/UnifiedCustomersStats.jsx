import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import CustomerStats from './CustomerStats';

/**
 * مكون موحد لإحصائيات العملاء
 * يستخدم النظام الموحد للصلاحيات وضمان عدم خلط عملاء المستخدمين
 */
const UnifiedCustomersStats = ({ onStatClick }) => {
  const { user } = usePermissions();
  const { data: allCustomers, loading } = useSupabaseData('customers');

  // تصفية العملاء - كل مستخدم يرى عملاءه فقط
  const filteredCustomers = React.useMemo(() => {
    if (!allCustomers) return [];
    
    return allCustomers.filter(customer => customer.created_by === user?.id);
  }, [allCustomers, user?.id]);

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