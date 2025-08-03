import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useUnifiedProfits } from '@/hooks/useUnifiedProfits';
import ProfitStats from './ProfitStats';

/**
 * مكون موحد لإحصائيات الأرباح
 * يستخدم النظام الموحد للصلاحيات وجلب البيانات
 */
const UnifiedProfitStats = ({ 
  onFilterChange, 
  onExpensesClick, 
  onSettledDuesClick, 
  onManagerProfitsClick,
  dateRange,
  showManagerProfitsCard = false,
  managerProfitsCardProps = {},
  showEmployeeReceivedCard = false,
  employeeReceivedCardProps = {}
}) => {
  const { canViewAllProfits, user } = usePermissions();
  const { profitData, unifiedNetProfit, loading } = useUnifiedProfits(dateRange);

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
    <ProfitStats
      profitData={profitData}
      canViewAll={canViewAllProfits}
      onFilterChange={onFilterChange}
      onExpensesClick={onExpensesClick}
      onSettledDuesClick={onSettledDuesClick}
      onManagerProfitsClick={onManagerProfitsClick}
      user={user}
      dateRange={dateRange}
      unifiedNetProfit={unifiedNetProfit}
      showManagerProfitsCard={showManagerProfitsCard}
      managerProfitsCardProps={managerProfitsCardProps}
      showEmployeeReceivedCard={showEmployeeReceivedCard}
      employeeReceivedCardProps={employeeReceivedCardProps}
    />
  );
};

export default UnifiedProfitStats;