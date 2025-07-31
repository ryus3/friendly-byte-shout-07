import React from 'react';
import UnifiedProfitDisplay from '@/components/shared/UnifiedProfitDisplay';

/**
 * مكون عرض الأرباح في لوحة التحكم - يستخدم العنصر الموحد
 * @deprecated - استخدم UnifiedProfitDisplay مباشرة
 */
const ProfitStats = ({
  profitData,
  canViewAll,
  onFilterChange,
  onExpensesClick,
  onSettledDuesClick,
  user,
}) => {
  return (
    <UnifiedProfitDisplay
      profitData={profitData}
      displayMode="dashboard"
      canViewAll={canViewAll}
      onFilterChange={onFilterChange}
      onExpensesClick={onExpensesClick}
      onSettledDuesClick={onSettledDuesClick}
    />
  );
};

export default ProfitStats;