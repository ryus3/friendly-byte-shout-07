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
    { key: 'myProfit', title: 'إجمالي الأرباح', value: profitData.totalPersonalProfit, icon: User, colors: ['green-500', 'emerald-500'], format: 'currency' },
    { key: 'pendingProfit', title: 'الأرباح المعلقة', value: profitData.personalPendingProfit, icon: Hourglass, colors: ['yellow-500', 'amber-500'], format: 'currency', onClick: () => onFilterChange('profitStatus', 'pending') },
    { key: 'settledProfit', title: 'الأرباح المستلمة', value: profitData.personalSettledProfit, icon: CheckCircle, colors: ['blue-500', 'sky-500'], format: 'currency', onClick: () => onFilterChange('profitStatus', 'settled') },
  ];

  if (canViewAll) {
    statCards.unshift(
      { key: 'managerProfitFromEmployees', title: 'أرباح من الموظفين', value: profitData.managerProfitFromEmployees, icon: Users, colors: ['indigo-500', 'violet-500'], format: 'currency', onClick: () => onFilterChange('employeeId', 'employees') },
      { key: 'totalExpenses', title: 'المصاريف العامة', value: profitData.totalExpenses, icon: TrendingDown, colors: ['red-500', 'orange-500'], format: 'currency', onClick: onExpensesClick },
      { key: 'totalSettledDues', title: 'المستحقات المدفوعة', value: profitData.totalSettledDues, icon: PackageCheck, colors: ['purple-500', 'violet-500'], format: 'currency', onClick: onSettledDuesClick }
    );
    // For admin, change "إجمالي أرباحي" to "أرباحي (المدير)" to avoid confusion
    const myProfitCard = statCards.find(c => c.key === 'myProfit');
    if (myProfitCard) {
        myProfitCard.title = 'أرباحي (المدير)';
    }
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${canViewAll ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-3'} gap-6`}>
      {statCards.map(card => <StatCard key={card.key} {...card} />)}
    </div>
  );
};

export default ProfitStats;