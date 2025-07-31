import React from 'react';
import UnifiedProfitDisplay from '@/components/shared/UnifiedProfitDisplay';
import ManagerProfitsCard from '@/components/shared/ManagerProfitsCard';

/**
 * مكون عرض الأرباح في لوحة التحكم - يستخدم العنصر الموحد
 */
const ProfitStats = ({
  profitData,
  canViewAll,
  onFilterChange,
  onExpensesClick,
  onSettledDuesClick,
  onManagerProfitsClick,
  user,
  dateRange,
  unifiedNetProfit,
  showManagerProfitsCard = false,
  managerProfitsCardProps = {}
}) => {
  return (
    <>
      <UnifiedProfitDisplay
        profitData={profitData}
        displayMode="dashboard"
        canViewAll={canViewAll}
        onFilterChange={onFilterChange}
        onExpensesClick={onExpensesClick}
        onSettledDuesClick={onSettledDuesClick}
        onManagerProfitsClick={onManagerProfitsClick}
        unifiedNetProfit={unifiedNetProfit}
      />
      
      {/* كارت أرباحي من الموظفين - أسفل صافي الأرباح */}
      {showManagerProfitsCard && (
        <div className="mt-4">
          <ManagerProfitsCard {...managerProfitsCardProps} />
        </div>
      )}
    </>
  );
};

export default ProfitStats;