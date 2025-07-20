import React, { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, Banknote } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useNetProfitCalculator } from './NetProfitCalculator';

// مكون القاصة الحقيقية - يحسب الرصيد الحقيقي بناءً على رأس المال والأرباح
const RealCashBox = ({ accounting, orders, products, period = 'month', onClick }) => {
  // استخدام حاسبة الأرباح الموحدة
  const netProfitData = useNetProfitCalculator(orders, accounting, products, period);
  
  const cashBoxData = useMemo(() => {
    const capital = accounting?.capital || 0;
    const realizedProfits = netProfitData.netProfit;
    const realCashBalance = capital + realizedProfits;
    
    return {
      capital,
      realizedProfits,
      realCashBalance,
      totalRevenue: netProfitData.totalRevenue,
      totalExpenses: netProfitData.totalExpenses,
      grossProfit: netProfitData.grossProfit
    };
  }, [accounting, netProfitData]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="رأس المال"
        value={cashBoxData.capital}
        icon={Banknote}
        colors={['slate-500', 'gray-600']}
        format="currency"
      />
      
      <StatCard
        title="الأرباح المُحققة"
        value={cashBoxData.realizedProfits}
        icon={TrendingUp}
        colors={cashBoxData.realizedProfits >= 0 ? ['green-500', 'emerald-500'] : ['red-500', 'orange-500']}
        format="currency"
      />
      
      <StatCard
        title="إجمالي المصاريف"
        value={cashBoxData.totalExpenses}
        icon={TrendingDown}
        colors={['red-500', 'orange-500']}
        format="currency"
      />
      
      <StatCard
        title="الرصيد الحقيقي"
        value={cashBoxData.realCashBalance}
        icon={Wallet}
        colors={cashBoxData.realCashBalance >= 0 ? ['blue-500', 'sky-500'] : ['red-500', 'orange-500']}
        format="currency"
        onClick={onClick}
        className="ring-2 ring-blue-200 dark:ring-blue-800"
      />
    </div>
  );
};

export default RealCashBox;