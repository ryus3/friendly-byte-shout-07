import React from 'react';
import StatCard from '@/components/dashboard/StatCard';
import { User, Hourglass, CheckCircle, Users, TrendingDown, PackageCheck } from 'lucide-react';

const ProfitStats = ({
  profitData,
  canViewAll,
  onFilterChange,
  onExpensesClick,
  onSettledDuesClick,
}) => {

  const statCards = [
    { key: 'pendingProfit', title: 'الأرباح المعلقة', value: profitData.personalPendingProfit, icon: Hourglass, colors: ['yellow-500', 'amber-500'], format: 'currency', onClick: () => onFilterChange('profitStatus', 'pending') },
    { key: 'settledProfit', title: 'الأرباح المستلمة', value: profitData.personalSettledProfit, icon: CheckCircle, colors: ['blue-500', 'sky-500'], format: 'currency', onClick: () => onFilterChange('profitStatus', 'settled') },
  ];

  if (canViewAll) {
    // للمدير: صافي الربح يحل محل "أرباحي" ويكون هو نفسه في لوحة التحكم والمركز المالي
    statCards.unshift(
      { key: 'netProfit', title: 'صافي الربح', value: profitData.netProfit, icon: User, colors: ['green-500', 'emerald-500'], format: 'currency' },
      { key: 'managerProfitFromEmployees', title: 'أرباح من الموظفين', value: profitData.managerProfitFromEmployees, icon: Users, colors: ['indigo-500', 'violet-500'], format: 'currency', onClick: () => onFilterChange('employeeId', 'employees') },
      { key: 'totalExpenses', title: 'المصاريف العامة', value: profitData.totalExpenses, icon: TrendingDown, colors: ['red-500', 'orange-500'], format: 'currency', onClick: onExpensesClick },
      { key: 'totalSettledDues', title: 'المستحقات المدفوعة', value: profitData.totalSettledDues, icon: PackageCheck, colors: ['purple-500', 'violet-500'], format: 'currency', onClick: onSettledDuesClick }
    );
  } else {
    // للموظف: إجمالي أرباحه الشخصية
    statCards.unshift(
      { key: 'myProfit', title: 'إجمالي أرباحي', value: profitData.totalPersonalProfit, icon: User, colors: ['green-500', 'emerald-500'], format: 'currency' }
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${canViewAll ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-3'} gap-6`}>
      {statCards.map(card => <StatCard key={card.key} {...card} />)}
    </div>
  );
};

export default ProfitStats;