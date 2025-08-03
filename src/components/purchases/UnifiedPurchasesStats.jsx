import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useImprovedPurchases } from '@/hooks/useImprovedPurchases';
import PurchasesStats from './PurchasesStats';

/**
 * مكون موحد لإحصائيات المشتريات
 * يستخدم النظام الموحد للصلاحيات وجلب البيانات
 */
const UnifiedPurchasesStats = ({ onFilterChange, onCardClick }) => {
  const { canViewAllPurchases, filterDataByUser } = usePermissions();
  const { purchases, loading } = useImprovedPurchases();

  // تصفية المشتريات حسب صلاحيات المستخدم
  const filteredPurchases = canViewAllPurchases 
    ? purchases 
    : filterDataByUser(purchases, 'created_by');

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
    <PurchasesStats
      purchases={filteredPurchases}
      onFilterChange={onFilterChange}
      onCardClick={onCardClick}
    />
  );
};

export default UnifiedPurchasesStats;