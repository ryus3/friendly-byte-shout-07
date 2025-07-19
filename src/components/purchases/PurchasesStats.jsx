import React, { useMemo } from 'react';
import StatCard from '@/components/dashboard/StatCard';
import { DollarSign, ShoppingCart, Calendar, Package } from 'lucide-react';

const PurchasesStats = ({ purchases, onCardClick }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const totalCost = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const monthPurchases = purchases.filter(p => new Date(p.created_at) >= startOfMonth);
    const yearPurchases = purchases.filter(p => new Date(p.created_at) >= startOfYear);
    
    const totalMonthCost = monthPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalYearCost = yearPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalItems = purchases.reduce((sum, p) => sum + (p.items?.length || 0), 0);

    return {
      totalCost,
      totalMonthCost,
      totalYearCost,
      totalItems,
      totalInvoices: purchases.length,
    };
  }, [purchases]);

  const statCards = [
    { title: 'إجمالي تكلفة المشتريات', value: stats.totalCost, icon: DollarSign, colors: ['green-500', 'emerald-500'], format: 'currency', onClick: () => onCardClick('all') },
    { title: 'تكلفة مشتريات الشهر', value: stats.totalMonthCost, icon: Calendar, colors: ['blue-500', 'sky-500'], format: 'currency', onClick: () => onCardClick('this_month') },
    { title: 'تكلفة مشتريات السنة', value: stats.totalYearCost, icon: Calendar, colors: ['purple-500', 'violet-500'], format: 'currency', onClick: () => onCardClick('this_year') },
    { title: 'إجمالي الفواتير', value: stats.totalInvoices, icon: ShoppingCart, colors: ['yellow-500', 'amber-500'], format: 'number', onClick: () => onCardClick('all') },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default PurchasesStats;