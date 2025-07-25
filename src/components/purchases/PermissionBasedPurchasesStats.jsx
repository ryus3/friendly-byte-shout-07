import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import PurchasesStats from './PurchasesStats';

const PermissionBasedPurchasesStats = ({ purchases, onCardClick, onFilterChange }) => {
  const { user } = useAuth();
  const { canViewAllData, isSalesEmployee, isAdmin } = usePermissions();

  // فلترة البيانات حسب صلاحيات المستخدم
  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    if (canViewAllData) return purchases;
    return purchases.filter(purchase => {
      const purchaseUserId = purchase.created_by;
      return purchaseUserId === user?.user_id || purchaseUserId === user?.id;
    });
  }, [purchases, canViewAllData, user?.id, user?.user_id]);

  return (
    <PurchasesStats
      purchases={filteredPurchases}
      onCardClick={onCardClick}
      onFilterChange={onFilterChange}
      showAllData={canViewAllData}
      userRole={isAdmin ? 'admin' : 'employee'}
    />
  );
};

export default PermissionBasedPurchasesStats;